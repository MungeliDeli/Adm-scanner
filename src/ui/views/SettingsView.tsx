import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "../../data/settings";

export function SettingsView(props: { cug: string; onCugSaved: (cug: string) => void }) {
  const [value, setValue] = useState(props.cug ?? "");
  const [scannerDebug, setScannerDebug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setValue(props.cug ?? "");
  }, [props.cug]);

  useEffect(() => {
    void getSettings().then((s) => setScannerDebug(Boolean(s.scannerDebug)));
  }, []);

  async function onSave() {
    setMsg(null);
    const cug = value.trim();
    if (!cug) {
      setMsg("CUG is required.");
      return;
    }
    setSaving(true);
    try {
      await saveSettings({ cug, scannerDebug });
      props.onCugSaved(cug);
      setMsg("Saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleDebug(next: boolean) {
    setScannerDebug(next);
    try {
      await saveSettings({ scannerDebug: next });
      setMsg(next ? "Scanner debug on — go back to Scan to see logs." : "Scanner debug off.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to save debug flag");
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

        <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3">
          <div>
            <div className="text-sm font-semibold">Scanner debug</div>
            <div className="mt-1 text-xs text-[rgb(var(--muted))]">
              Shows camera + decode logs on the Scan screen (useful on a phone).
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={scannerDebug}
            onClick={() => void onToggleDebug(!scannerDebug)}
            className={[
              "relative h-8 w-14 shrink-0 rounded-full transition-colors",
              scannerDebug ? "bg-emerald-600" : "bg-[rgb(var(--border))]",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform",
                scannerDebug ? "left-7" : "left-1",
              ].join(" ")}
            />
          </button>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-airtel-red px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save CUG"}
        </button>

        {msg ? <div className="mt-3 text-xs text-[rgb(var(--muted))]">{msg}</div> : null}
      </div>
    </div>
  );
}
