import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { rpc } from "@/lib/rpc";
import { readAISettings } from "@/lib/ai/settings";
import { Icon } from "@/components/ui";
async function administrator() {
  const client = await requireStaff();
  const result = await rpc(client, "my_memberships");
  if (
    !result.data?.ok ||
    !result.data.data.some((m: { role: string }) => m.role === "site_admin")
  )
    return false;
  return true;
}
export default async function AISettings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const query = await searchParams;
  if (!(await administrator()))
    return (
      <main id="main" className="clinic-page">
        <h1>AI settings</h1>
        <p>Provider configuration is managed by a site administrator.</p>
      </main>
    );
  let settings: ReturnType<typeof readAISettings> | undefined;
  try {
    settings = readAISettings();
  } catch {
    /* Keep configuration recovery available. */
  }
  async function save(form: FormData) {
    "use server";
    if (!(await administrator())) redirect("/staff");
    const provider = String(form.get("provider"));
    if (!["local", "gemini", "compatible"].includes(provider))
      redirect("/staff/ai?error=configuration");
    try {
      const config = readAISettings({ ...process.env, AI_PROVIDER: provider });
      if (config.provider !== "local" && !config.apiKey) throw new Error();
      mkdirSync("var/ai", { recursive: true });
      const temporary = `var/ai/selection-${randomUUID()}.tmp`;
      writeFileSync(
        temporary,
        JSON.stringify({ provider, updatedAt: new Date().toISOString() }),
      );
      renameSync(temporary, "var/ai/selection.json");
    } catch {
      redirect("/staff/ai?error=configuration");
    }
    redirect("/staff/ai?saved=1");
  }
  return (
    <main id="main" className="clinic-page">
      <div className="page-heading">
        <p className="eyebrow">Administration</p>
        <h1>AI provider settings</h1>
        <p>Select the configured provider for new processing requests.</p>
      </div>
      {query.saved && (
        <p className="info-note" role="status">
          <Icon name="check" />
          Provider saved. Running requests retain their selected provider.
        </p>
      )}
      {(query.error || !settings) && (
        <p className="error" role="alert">
          Provider could not be enabled. Check the server configuration,
          credentials and data-region settings.
        </p>
      )}
      <div className="demo-split">
        <form action={save} className="panel">
          <h2>Processing provider</h2>
          <label>
            Provider
            <select
              name="provider"
              defaultValue={settings?.provider || "local"}
              disabled={!!process.env.AI_PROVIDER}
            >
              <option value="local">Local AI</option>
              <option value="gemini">Google Gemini</option>
              <option value="compatible">Configured compatible provider</option>
            </select>
          </label>
          <dl className="answer-review">
            <div>
              <dt>Current model</dt>
              <dd>{settings?.model || "Configuration required"}</dd>
            </div>
            <div>
              <dt>Context budget</dt>
              <dd>{settings?.context.toLocaleString() || "—"} tokens</dd>
            </div>
            <div>
              <dt>Image understanding</dt>
              <dd>
                {settings?.vision ? "Enabled in configuration" : "Not enabled"}
              </dd>
            </div>
            <div>
              <dt>Processing region</dt>
              <dd>{settings?.region || "Unverified"}</dd>
            </div>
          </dl>
          {process.env.AI_PROVIDER ? (
            <p className="info-note">
              Provider selection is locked by the server environment. Your
              operator can remove the AI_PROVIDER process variable to allow
              changes here.
            </p>
          ) : (
            <button className="block">Save provider</button>
          )}
        </form>
        <aside className="panel">
          <span className="icon-circle">
            <Icon name="lock" size={28} />
          </span>
          <h2 className="block">Credentials stay on the server</h2>
          <p>
            API keys, endpoints and model identifiers are configured by your
            operator. They are never sent to this browser.
          </p>
          <p>
            No automatic provider switching occurs when a request fails. The
            selected provider and prompt version are recorded with the
            assessment.
          </p>
          <p className="muted">
            {existsSync(".env.ai")
              ? "Provider configuration is available."
              : "Your operator needs to configure the provider credentials before enabling a cloud provider."}
          </p>
        </aside>
      </div>
    </main>
  );
}
