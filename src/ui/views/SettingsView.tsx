import { useState } from "react";
import { saveSettings } from "../../data/settings";

export function SettingsView(props: { cug: string; onCugSaved: (cug: string) => void }) {
  const [value, setValue] = useState(props.cug ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSave() {
    setMsg(null);
    const cug = value.trim();
    if (!cug) {
      setMsg("CUG is required.");
      return;
    }
    setSaving(true);
    try {
      await saveSettings({ cug });
      props.onCugSaved(cug);
      setMsg("Saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4">
        <div className="text-sm font-semibold">Settings</div>
        <div className="mt-1 text-xs text-[rgb(var(--muted))]">Dark mode only.</div>

        <label className="mt-4 block text-xs text-[rgb(var(--muted))]">CUG</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          placeholder="Enter your CUG"
          className="mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm outline-none focus:border-airtel-red"
        />

        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-airtel-red px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>

        {msg ? <div className="mt-3 text-xs text-[rgb(var(--muted))]">{msg}</div> : null}
      </div>
    </div>
  );
}

