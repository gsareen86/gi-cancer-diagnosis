# LLM Gateway: logic carried forward

Load this for the `llm-gateway` change (and when another change calls the gateway). It
records the behaviour proven in the pre-reset AI service so the rebuild keeps it. The
implementation language is decided in that change's design.

## Role

- The **only** component with model egress. It holds provider credentials; the web app never
  calls a provider directly. Internal only, protected by a service token, and it refuses to
  start without one.
- Receives a compiled, minimised case plus a JSON Schema; returns a structured result and
  the identity of the model that produced it. It makes no clinical decisions.

## Connectors

| Connector | Use | Structured-output mechanism |
| --- | --- | --- |
| `llamacpp` | Demo on the local machine: `llama-server`'s OpenAI-compatible `/v1/chat/completions` | `response_format: json_schema, strict: true` (compiled to a grammar, so non-conforming tokens can't be sampled) |
| `azure-openai` | Pilot: regional deployment in an India region only | Structured outputs, `json_schema` strict |
| `anthropic` | Development with synthetic data only; never with real data | One forced tool with `strict: true`, `disable_parallel_tool_use: true`; adaptive thinking; no `temperature` on Claude 5 models (returns 400) |

- The connector is chosen by explicit configuration. An unknown value is a startup error.
  **Never fall back silently** to another provider.
- Each environment has an allowlist of connectors; real-data environments allow only
  India-processing connectors (invariant D4).

## Behaviours to keep

- **The caller's schema validation is the control.** The gateway returns output verbatim, with
  no repair or cleaning; a looser second pass would hide the responses validation must catch.
- **Record the model that actually answered**, taken from the response rather than from
  configuration. An alias or a stub on the expected port can differ from what was configured.
- **Errors surface, not retry:** a refusal returns 422 with its category; no structured result
  returns 502; an unreachable local server returns 502 with the reason. The case still reaches
  the clinician with AI marked unavailable (invariant S6).
- **Local sampling:** temperature 0.1 and top_p 0.9, because greedy decoding loops on quantised
  models. Send `chat_template_kwargs: {enable_thinking: false}` for Qwen3-style models, since
  thinking blocks fight constrained decoding.
- **Context budget warning:** estimate prompt tokens (characters ÷ 3) plus max output
  (default 2048) against the configured context (e.g. 16384); warn before the server truncates.
- **Timeouts:** 900 s for local inference (a 27B model on an APU is slow); the caller waits slightly longer.
- **Health without waking:** probe only `/props`, which is exempt from llama.cpp's idle timer.
  Never probe `/v1/models` or a completion endpoint. Report configured and served model
  separately, with `modelState` ready / sleeping / loading / unavailable. Sleeping counts as healthy.
- **Idle sleep:** llama-server `--sleep-idle-seconds` (default 300; `-1` disables). Restart
  the model only when all slots are idle, and only a listener matching the configured binary and
  model file. Never kill an unknown process, and never download binaries or weights automatically.

## Local runtime on the owner's machine

```text
env: HIP_VISIBLE_DEVICES=0  GGML_VULKAN_UNIFIED_MEMORY=1  ROCBLAS_USE_HIPBLASLT=1
llama-server -m <model>.gguf --host 127.0.0.1 --port 8080 --alias <name> -c 16384 -ngl 99 --no-mmap
  --sleep-idle-seconds 300 --flash-attn on -b 512 -ub 64 -t 4 -tb 12 -ctk q8_0 -ctv q8_0
```

Previously configured model label: `qwen3-27b-q4_k_m`. The earlier local settings files
(binary and model paths, tokens) were moved to `var/pre-reset-local/` (not in git).

## Deliberately not carried forward

- The old assessment prompt and its high/moderate/low likelihood schema (conflicts with S4)
- Regex report extraction and the hashing-placeholder embeddings/retrieval
- The pre-reset clinical request/response schemas

## Archived source

On branch `codex/gi-specialty-navigation`, read with `git show codex/gi-specialty-navigation:<path>`:
`services/ai/gi_ai/provider.py`, `local_model.py`, `model.py`, `app.py`, `services/ai/tests/test_local_model.py`,
`test_model.py`, `scripts/start-ai.ps1`, `e2e/model-idle.mjs`, `e2e/stub-llama-server.mjs`.
