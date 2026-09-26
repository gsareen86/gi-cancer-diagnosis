import { statSync } from "node:fs";
import { resolve } from "node:path";
export type ModelReceipt = {
  model: string;
  context: number;
  files: Array<{
    path: string;
    sha256: string;
    size: number;
    modifiedAt: string;
  }>;
};
export function checkModelIdentity(
  settings: Record<string, string>,
  receipt: ModelReceipt,
  servedPath: string,
  stats: (path: string) => { size: number; mtimeMs: number } = statSync,
) {
  if (
    resolve(servedPath) !== resolve(settings.LLAMA_MODEL) ||
    receipt.model !== "gi-compass-local" ||
    receipt.context !== Number(settings.LLAMA_CONTEXT || 16384)
  )
    throw new Error("model_identity_mismatch");
  for (const [path, pin] of [
    [settings.LLAMA_MODEL, settings.LLAMA_MODEL_SHA256],
    [settings.LLAMA_SERVER_BIN, settings.LLAMA_BINARY_SHA256],
    ...(settings.LLAMA_MMPROJ
      ? [[settings.LLAMA_MMPROJ, settings.LLAMA_MMPROJ_SHA256]]
      : []),
  ]) {
    const checked = receipt.files.find(
      (f) => resolve(f.path) === resolve(path),
    );
    if (
      !checked ||
      !/^[a-f\d]{64}$/i.test(pin) ||
      checked.sha256.toLowerCase() !== pin.toLowerCase()
    )
      throw new Error("model_identity_mismatch");
    const actual = stats(path);
    if (
      actual.size !== checked.size ||
      Math.floor(actual.mtimeMs) !== Date.parse(checked.modifiedAt)
    )
      throw new Error("model_identity_mismatch");
  }
}
