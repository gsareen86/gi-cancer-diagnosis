// Local, non-clinical live check. Never starts/stops processes or changes their configuration.
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const model = 'http://127.0.0.1:8080';
const gateway = 'http://127.0.0.1:8000';
const idleSeconds = Number(process.env.TEST_MODEL_IDLE_SECONDS ?? 300);
assert(Number.isInteger(idleSeconds) && idleSeconds > 0);
const json = async url => {
  // Native cold loading can temporarily delay /props; readiness is polled, never inferred.
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return response.ok ? response.json() : null;
  } catch { return null; }
};
async function waitForSleep() {
  const deadline = Date.now() + (idleSeconds + 120) * 1000;
  while (Date.now() < deadline) {
    const props = await json(`${model}/props`);
    if (props?.is_sleeping) return props;
    await delay(2000);
  }
  throw new Error('Model did not sleep after configured idle period');
}
const asleep = await waitForSleep();
assert(asleep.model_alias && !/stub/i.test(asleep.model_alias));
console.log('PASS: idle model is sleeping');
for (let i = 0; i < 8; i++) {
  const health = await json(`${gateway}/health`);
  assert.equal(health?.modelState, 'sleeping');
  assert.equal(health?.reachable, true);
  assert.equal((await json(`${model}/props`))?.is_sleeping, true);
  await delay(2000);
}
console.log('PASS: repeated gateway health checks do not wake the model');
let pending = 2;
let awake = false;
let activePolls = 0;
const started = Date.now();
const requests = [1, 2].map(async number => {
  try {
    const response = await fetch(`${model}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(900000),
      body: JSON.stringify({ model: asleep.model_alias,
        messages: [{ role: 'user', content: `Non-clinical runtime test ${number}. Write a long numbered list of 100 fictional garden names. No personal information. /no_think` }],
        max_tokens: 768, temperature: 0.1, chat_template_kwargs: { enable_thinking: false },
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert(body.choices?.[0]?.message?.content?.length > 0);
    assert(body.usage?.completion_tokens > 0);
    console.log(`PASS: concurrent request ${number} completed with real model output`);
  } finally { pending--; }
});
// Attach handlers before polling; a failed request cannot become an unhandled rejection.
const completed = Promise.allSettled(requests);
while (pending) {
  const props = await json(`${model}/props`);
  if (props?.is_sleeping === false) { awake = true; activePolls++; }
  if (awake && pending && props) assert.equal(props.is_sleeping, false, 'slept while requests were active');
  await delay(2000);
}
for (const result of await completed) if (result.status === 'rejected') throw result.reason;
assert(awake && activePolls > 0);
assert(Date.now() - started > idleSeconds * 1000, 'Use a shorter test idle interval to exercise in-flight protection');
console.log(`PASS: automatic reload and no sleep during active requests (${activePolls} polls)`);
await waitForSleep();
console.log('PASS: returned to sleep after both requests completed');
