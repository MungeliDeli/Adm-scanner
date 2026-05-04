import { useEffect, useMemo, useState } from "react";
import type { ScanRecord } from "../../data/db";
import { listScans } from "../../data/scans";

function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function dayTitle(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" });
}

export function HistoryView() {
  const [items, setItems] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const all = await listScans(2000);
      if (!cancelled) setItems(all);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, ScanRecord[]>();
    for (const it of items) {
      const k = dayKey(it.timestamp);
      const arr = m.get(k) ?? [];
      arr.push(it);
      m.set(k, arr);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm font-semibold">History</div>
          <div className="text-xs text-[rgb(var(--muted))]">Devices scanned on this phone.</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 text-sm text-[rgb(var(--muted))]">
          Loading…
        </div>
      ) : null}

      {!loading && grouped.length === 0 ? (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 text-sm text-[rgb(var(--muted))]">
          No scans yet.
        </div>
      ) : null}

      {grouped.map(([k, scans]) => (
        <div key={k} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgb(var(--border))]">
            <div className="text-sm font-semibold">{dayTitle(scans[0]?.timestamp ?? k)}</div>
            <div className="text-xs text-[rgb(var(--muted))]">{scans.length} devices</div>
          </div>
          <ol className="px-4 py-3 space-y-2">
            {scans.map((s, idx) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <div className="w-6 text-xs text-[rgb(var(--muted))]">{idx + 1}.</div>
                  <div className="font-mono text-sm">{s.imei}</div>
                </div>
                <div className="text-[11px] text-[rgb(var(--muted))]">
                  {s.status === "sent" ? "Sent" : s.status === "queued" ? "Queued" : "Error"}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

