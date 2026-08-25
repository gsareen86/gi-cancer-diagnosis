import { createServer } from 'node:http';

/**
 * A stand-in for llama-server, speaking just enough of the OpenAI-compatible API to exercise the
 * whole path: the doctor's button, the core application, the Python AI service, schema
 * validation, storage, and rendering.
 *
 * It answers from the JSON Schema it is sent rather than from a fixed fixture, so the response is
 * shaped by the same contract a real model would be constrained to — including the taxonomy enum,
 * which is what proves the permitted-vocabulary wiring reaches the model at all.
 *
 * Exists so this path can be verified without a multi-gigabyte download. It says nothing about
 * whether a real model's clinical reasoning is any good.
 */

const PORT = Number(process.env.STUB_PORT ?? 8080);

function firstEnum(schema, path) {
  const node = path.reduce((current, key) => current?.[key], schema);
  return node?.enum?.[0];
}

function buildAssessment(schema, caseId, promptVersion) {
  // The condition must come from the enum the caller generated; anything else is rejected
  // downstream, which is exactly the behaviour worth exercising.
  const condition =
    firstEnum(schema, [
      'properties',
      'differential_assessment',
      'items',
      'properties',
      'condition',
    ]) ?? 'Peptic ulcer disease';

  const disclaimer =
    schema?.properties?.disclaimer?.const ??
    'This is an AI-generated decision-support summary based on patient-reported information and ' +
      'is not a medical diagnosis. It has not yet been reviewed by a physician. All clinical ' +
      'decisions must be made by the treating doctor after direct evaluation.';

  return {
    case_id: caseId,
    model_version: 'stub-llamacpp',
    prompt_version: promptVersion,
    kb_version: 'kb-seed-1',
    generated_at: new Date().toISOString(),
    differential_assessment: [
      {
        condition,
        likelihood: 'moderate',
        supporting_findings: [
          'Reported black tarry stool alongside lightheadedness',
          'Symptom pattern consistent with an upper gastrointestinal source',
        ],
        contradicting_or_atypical_findings: ['No unintentional weight loss reported'],
        suggested_confirmatory_steps: ['Upper GI endoscopy', 'Full blood count and iron studies'],
      },
    ],
    red_flags: [
      {
        flag: 'Reported pattern consistent with active upper gastrointestinal bleeding',
        basis: 'Black tarry stool reported together with lightheadedness',
        urgency: 'emergency',
      },
    ],
    recommended_next_steps: [
      'Urgent in-person assessment by a gastroenterologist',
      'Upper GI endoscopy within one week',
    ],
    clinician_summary:
      'Adult reporting melaena with associated lightheadedness. The pattern warrants urgent upper ' +
      'gastrointestinal evaluation, and the reported painkiller use is worth exploring at review.',
    disclaimer,
  };
}

const server = createServer((request, response) => {
  if (request.method !== 'POST' || !request.url?.startsWith('/v1/chat/completions')) {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      response.writeHead(400).end('bad json');
      return;
    }

    const schema = parsed.response_format?.json_schema?.schema;
    if (schema === undefined) {
      // A real llama-server would happily answer in prose; refusing here makes the omission
      // obvious rather than letting it look like it worked.
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'no json_schema in response_format' }));
      return;
    }

    const userMessage = parsed.messages?.find((m) => m.role === 'user')?.content ?? '';
    const caseId = /case ([0-9a-f-]{36})/i.exec(userMessage)?.[1] ?? 'unknown-case';
    const promptVersion = /"([a-z0-9-]+)" as prompt_version/i.exec(userMessage)?.[1] ?? 'unknown';

    console.log(`[stub] answering case ${caseId} (thinking disabled: ${
      parsed.chat_template_kwargs?.enable_thinking === false
    })`);

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify(buildAssessment(schema, caseId, promptVersion)),
            },
          },
        ],
      }),
    );
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`stub llama-server on http://127.0.0.1:${PORT} — not a model, a shape`);
});
