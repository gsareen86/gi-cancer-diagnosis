/** Bound network failures without discarding a caller's cancellation signal. */
export const boundedFetch: typeof fetch = (input, init) => {
  const signals = [AbortSignal.timeout(10000)];
  const callerSignal =
    init?.signal ?? (input instanceof Request ? input.signal : null);
  if (callerSignal) signals.push(callerSignal);
  return fetch(input, {
    ...init,
    signal: AbortSignal.any(signals),
    cache: "no-store",
  });
};
