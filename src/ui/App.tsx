import { useEffect, useMemo, useState } from "react";
import { HeaderMenu } from "./components/HeaderMenu";
import { HistoryView } from "./views/HistoryView";
import { ScanView } from "./views/ScanView";
import { SettingsView } from "./views/SettingsView";
import { useOnline } from "./hooks/useOnline";
import { getSettings } from "../data/settings";

type View = "scan" | "history" | "settings";

export function App() {
  const [view, setView] = useState<View>("scan");
  const online = useOnline();

  const [cug, setCug] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getSettings();
      if (!cancelled) setCug(s.cug ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const titleRight = useMemo(() => {
    return (
      <div className="flex items-center gap-2">
        <div
          className={[
            "h-2 w-2 rounded-full",
            online ? "bg-emerald-400" : "bg-amber-400",
          ].join(" ")}
          aria-hidden="true"
        />
        <div className="text-[11px] text-[rgb(var(--muted))]">{online ? "Online" : "Offline"}</div>
      </div>
    );
  }, [online]);

  return (
    <div className="min-h-dvh bg-[rgb(var(--bg))] text-[rgb(var(--fg))]">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))]/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-md items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-sm bg-airtel-red" aria-hidden="true" />
            <div className="text-sm font-semibold tracking-wide">ADM Scanner</div>
          </div>

          <div className="flex items-center gap-3">
            {titleRight}
            <HeaderMenu
              onGoHistory={() => setView("history")}
              onGoSettings={() => setView("settings")}
              onGoScan={() => setView("scan")}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-14 pb-24">
        {view === "scan" ? <ScanView cug={cug} onNeedSettings={() => setView("settings")} /> : null}
        {view === "history" ? <HistoryView /> : null}
        {view === "settings" ? <SettingsView cug={cug} onCugSaved={setCug} /> : null}
      </main>
    </div>
  );
}

