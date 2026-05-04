import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { addScan, listByStatus, markError, markSent } from "../../data/scans";
import { postDeviceRecords } from "../../data/api";
import type { ScanRecord } from "../../data/db";

function normalizeImei(raw: string): string {
  const s = raw.trim();
  // Common: barcodes sometimes include whitespace; keep digits only if it looks numeric-ish.
  const digits = s.replace(/\D+/g, "");
  if (digits.length >= 10 && digits.length <= 32) return digits;
  return s;
}

export function ScanView(props: { cug: string; onNeedSettings: () => void }) {
  const [session, setSession] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastRef = useRef<{ text: string; at: number } | null>(null);

  const canScan = Boolean(props.cug?.trim());

  async function start() {
    if (!canScan) return;
    if (!videoRef.current) return;

    setStatus(null);
    const reader = new BrowserMultiFormatReader();

    // Stop any previous session
    try {
      controlsRef.current?.stop();
    } catch {
      // ignore
    }

    const constraints: MediaTrackConstraints = {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    };

    controlsRef.current = await reader.decodeFromConstraints(
      { video: constraints, audio: false },
      videoRef.current,
      async (result, error, controls) => {
        if (result) {
          const raw = result.getText();
          const text = normalizeImei(raw);

          // Debounce duplicates (thin barcodes often read multiple times)
          const now = Date.now();
          const last = lastRef.current;
          if (last && last.text === text && now - last.at < 1200) return;
          lastRef.current = { text, at: now };

          setSession((prev) => {
            if (prev.includes(text)) return prev;
            return [text, ...prev];
          });
          setStatus(`Scanned: ${text}`);

          // Small pause to prevent repeated reads, then continue
          try {
            controls.stop();
          } catch {
            // ignore
          }
          setTimeout(() => {
            start().catch(() => {});
          }, 250);
        } else if (error) {
          // ignore decode noise; keep scanning
          void controls;
        }
      },
    );
  }

  function stop() {
    try {
      controlsRef.current?.stop();
    } catch {
      // ignore
    } finally {
      controlsRef.current = null;
    }
  }

  useEffect(() => {
    // auto-start on mount
    start().catch((e) => setStatus(e instanceof Error ? e.message : "Camera failed"));
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canScan]);

  const sessionCount = session.length;

  const hint = useMemo(() => {
    return (
      <div className="text-xs text-[rgb(var(--muted))]">
        Tip: keep the barcode centered in the box, move slightly closer/farther for thin codes.
      </div>
    );
  }, []);

  async function submit() {
    setStatus(null);
    if (!props.cug?.trim()) {
      props.onNeedSettings();
      return;
    }

    setSubmitting(true);
    try {
      // Save current session into offline queue first (always)
      const saved: ScanRecord[] = [];
      for (const imei of session) {
        saved.push(await addScan({ cug: props.cug, imei, timestamp: new Date().toISOString() }));
      }
      setSession([]);

      // Try syncing ALL queued records (including just-added)
      if (navigator.onLine) {
        const queued = await listByStatus("queued");
        if (queued.length > 0) {
          const res = await postDeviceRecords(
            queued.map((q) => ({ cug: q.cug, imei: q.imei, timestamp: q.timestamp })),
          );
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            await markError(
              queued.map((q) => q.id),
              text || `Upload failed (${res.status})`,
            );
            setStatus("Saved offline. Upload failed (will retry when you submit again).");
            return;
          }
          await markSent(queued.map((q) => q.id));
          setStatus(`Submitted ${queued.length} device(s).`);
          return;
        }
      }

      setStatus("Saved offline.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {!canScan ? (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4">
          <div className="text-sm font-semibold">Set your CUG first</div>
          <div className="mt-1 text-xs text-[rgb(var(--muted))]">
            The scanner attaches your CUG + timestamp to each IMEI.
          </div>
          <button
            type="button"
            onClick={props.onNeedSettings}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-airtel-red px-3 py-2 text-sm font-semibold text-black"
          >
            Open Settings
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <div>
            <div className="text-sm font-semibold">Scan</div>
            <div className="text-xs text-[rgb(var(--muted))]">CUG: {props.cug}</div>
          </div>
          <div className="text-xs text-[rgb(var(--muted))]">{sessionCount} in session</div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-black">
          <video ref={videoRef} className="h-[320px] w-full object-cover" muted playsInline />

          {/* Scan box tuned for thin barcodes */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-36 w-[85%] rounded-2xl border border-airtel-red/70 bg-airtel-red/5">
              <div className="absolute left-1/2 top-1/2 h-[2px] w-[78%] -translate-x-1/2 -translate-y-1/2 bg-airtel-red/60" />
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {hint}
          {status ? <div className="text-xs text-[rgb(var(--muted))]">{status}</div> : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => start().catch((e) => setStatus(e instanceof Error ? e.message : "Camera failed"))}
              className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm font-semibold"
            >
              Restart camera
            </button>
            <button
              type="button"
              disabled={submitting || sessionCount === 0}
              onClick={submit}
              className="rounded-xl bg-airtel-red px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      </div>

      {sessionCount > 0 ? (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Session list</div>
              <div className="text-xs text-[rgb(var(--muted))]">Scanned since you opened the app.</div>
            </div>
            <button
              type="button"
              onClick={() => setSession([])}
              className="text-xs font-semibold text-airtel-red"
            >
              Clear
            </button>
          </div>
          <ol className="px-4 py-3 space-y-2">
            {session.map((imei, idx) => (
              <li key={imei} className="flex items-baseline gap-3">
                <div className="w-6 text-xs text-[rgb(var(--muted))]">{idx + 1}.</div>
                <div className="font-mono text-sm">{imei}</div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

