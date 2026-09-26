import { describe, it, expect } from "vitest";
import {
  checkModelIdentity,
  type ModelReceipt,
} from "../../src/lib/demo/model-identity";
const settings = {
  LLAMA_MODEL: "C:/synthetic/model.gguf",
  LLAMA_SERVER_BIN: "C:/synthetic/server.exe",
  LLAMA_MODEL_SHA256: "a".repeat(64),
  LLAMA_BINARY_SHA256: "b".repeat(64),
};
const receipt: ModelReceipt = {
  model: "gi-compass-local",
  context: 16384,
  files: [
    {
      path: settings.LLAMA_MODEL,
      sha256: settings.LLAMA_MODEL_SHA256,
      size: 100,
      modifiedAt: "2026-09-21T00:00:00.000Z",
    },
    {
      path: settings.LLAMA_SERVER_BIN,
      sha256: settings.LLAMA_BINARY_SHA256,
      size: 100,
      modifiedAt: "2026-09-21T00:00:00.000Z",
    },
  ],
};
const stats = () => ({
  size: 100,
  mtimeMs: Date.parse(receipt.files[0].modifiedAt),
});
describe("Local model startup receipt", () => {
  it("accepts the selected pinned files verified before model startup", () =>
    expect(() =>
      checkModelIdentity(settings, receipt, settings.LLAMA_MODEL, stats),
    ).not.toThrow());
  it("rejects a different served weight file", () =>
    expect(() =>
      checkModelIdentity(settings, receipt, "C:/synthetic/other.gguf", stats),
    ).toThrow());
  it("rejects changes after startup verification", () =>
    expect(() =>
      checkModelIdentity(settings, receipt, settings.LLAMA_MODEL, () => ({
        ...stats(),
        size: 101,
      })),
    ).toThrow());
  it("rejects an unpinned binary even with matching metadata", () =>
    expect(() =>
      checkModelIdentity(
        { ...settings, LLAMA_BINARY_SHA256: "c".repeat(64) },
        receipt,
        settings.LLAMA_MODEL,
        stats,
      ),
    ).toThrow());
});
