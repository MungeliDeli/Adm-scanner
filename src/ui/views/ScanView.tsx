import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import { addScan, listByStatus, markError, markSent } from "../../data/scans";
import { postDeviceRecords } from "../../data/api";
import type { ScanRecord } from "../../data/db";
import { getSettings } from "../../data/settings";
import { createScannerHints } from "../../scanner/hints";

function normalizeImei(raw: string): string {
  const s = raw.trim();
  const digits = s.replace(/\D+/g, "");
  if (digits.length >= 10 && digits.length <= 32) return digits;
  return s;
}

function pickBackCameraId(devices: MediaDeviceInfo[]): string | undefined {
  for (const d of devices) {
    const label = d.label.toLowerCase();
    if (label.includes("back") || label.includes("rear") || label.includes("environment")) {
      return d.deviceId;
    }
  }
  if (devices.length === 1) return devices[0].deviceId;
  if (devices.length > 1) return devices[devices.length - 1].deviceId;
  return undefined;
}

function cropBandFromVideo(video: HTMLVideoElement): HTMLCanvasElement {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const sx = Math.floor(w * 0.05);
  const sy = Math.floor(h * 0.38);
  const sw = Math.floor(w * 0.9);
  const sh = Math.floor(h * 0.22);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, sw);
  canvas.height = Math.max(1, sh);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

function fullFrameCanvas(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, video.videoWidth);
  canvas.height = Math.max(1, video.videoHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const DEBUG_MAX = 40;

export function ScanView(props: { cug: string; onNeedSettings: () => void }) {
  const [session, setSession] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [lastOk, setLastOk] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [manualImei, setManualImei] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [snapBusy, setSnapBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastRef = useRef<{ text: string; at: number } | null>(null);
  const notFoundCountRef = useRef(0);

  const canScan = Boolean(props.cug?.trim());

  const pushDebug = useCallback(
    (line: string) => {
      if (!debugEnabled) return;
      const ts = new Date().toISOString().slice(11, 23);
      setDebugLines((prev) => [`${ts} ${line}`, ...prev].slice(0, DEBUG_MAX));
    },
    [debugEnabled],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (!cancelled) setDebugEnabled(Boolean(s.scannerDebug));
    });
    const onChanged = () => {
      getSettings().then((s) => setDebugEnabled(Boolean(s.scannerDebug)));
    };
    window.addEventListener("adm-settings-changed", onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("adm-settings-changed", onChanged);
    };
  }, []);

  function stopScanner() {
    try {
      controlsRef.current?.stop();
    } catch {
      // ignore
    } finally {
      controlsRef.current = null;
    }
  }

  const onDecoded = useCallback(
    (raw: string) => {
      const text = normalizeImei(raw);
      const now = Date.now();
      const last = lastRef.current;
      if (last && last.text === text && now - last.at < 900) return;
      lastRef.current = { text, at: now };

      setSession((prev) => {
        if (prev.includes(text)) return prev;
        return [text, ...prev];
      });
      setLastOk(text);
      setStatus(`Added: ${text}`);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 650);
      if (typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(35);
        } catch {
          // ignore
        }
      }
      pushDebug(`decode ok: ${text}`);
    },
    [pushDebug],
  );

  const startScanner = useCallback(async () => {
    if (!canScan) return;
    const video = videoRef.current;
    if (!video) return;

    stopScanner();

    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader(createScannerHints(), {
        delayBetweenScanAttempts: 120,
        delayBetweenScanSuccess: 300,
      });
    }
    const reader = readerRef.current;

    setStatus("Starting camera…");
    setCameraReady(false);
    pushDebug("startScanner()");

    let deviceId: string | undefined;
    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      pushDebug(`cameras: ${devices.length}`);
      devices.forEach((d, i) => pushDebug(`  [${i}] ${d.label || "(no label)"}`));
      deviceId = pickBackCameraId(devices);
      pushDebug(`picked deviceId: ${deviceId ? "yes" : "default"}`);
    } catch (e) {
      pushDebug(`listVideoInputDevices: ${e instanceof Error ? e.message : String(e)}`);
    }

    const onVideoMeta = () => {
      const v = videoRef.current;
      if (!v) return;
      pushDebug(`video metadata ${v.videoWidth}x${v.videoHeight}`);
      setCameraReady(v.videoWidth > 2 && v.videoHeight > 2);
    };
    video.addEventListener("loadedmetadata", onVideoMeta, { once: true });

    try {
      controlsRef.current = await reader.decodeFromVideoDevice(deviceId, video, (result, err) => {
        if (result) {
          notFoundCountRef.current = 0;
          onDecoded(result.getText());
          return;
        }
        if (!err) return;
        if (err instanceof NotFoundException) {
          notFoundCountRef.current += 1;
          if (debugEnabled && notFoundCountRef.current % 45 === 1) {
            pushDebug(`scanning… (no barcode in frame yet)`);
          }
          return;
        }
        pushDebug(`decode err: ${err.name} ${err.message}`);
      });
      setStatus(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Camera error: ${msg}`);
      pushDebug(`decodeFromVideoDevice failed: ${msg}`);
      try {
        controlsRef.current = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          },
          video,
          (result, err) => {
            if (result) {
              notFoundCountRef.current = 0;
              onDecoded(result.getText());
              return;
            }
            if (!err || err instanceof NotFoundException) return;
            pushDebug(`fallback decode err: ${err.message}`);
          },
        );
        setStatus(null);
      } catch (e2) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        setStatus(`Camera error: ${msg2}. Tap “Start camera” after allowing permission.`);
        pushDebug(`decodeFromConstraints failed: ${msg2}`);
      }
    }
  }, [canScan, debugEnabled, onDecoded, pushDebug]);

  const startScannerRef = useRef(startScanner);
  startScannerRef.current = startScanner;

  useEffect(() => {
    if (!canScan) {
      stopScanner();
      return;
    }
    const t = window.setTimeout(() => {
      void startScannerRef.current?.();
    }, 400);
    return () => {
      window.clearTimeout(t);
      stopScanner();
    };
  }, [canScan]);

  async function tryDecodeCanvas(reader: BrowserMultiFormatReader, canvas: HTMLCanvasElement): Promise<string | null> {
    try {
      const res = reader.decodeFromCanvas(canvas);
      return res.getText();
    } catch {
      return null;
    }
  }

  async function captureFrameDecode() {
    const video = videoRef.current;
    const reader = readerRef.current ?? new BrowserMultiFormatReader(createScannerHints());
    readerRef.current = reader;
    if (!video || video.videoWidth < 2) {
      setStatus("Wait for the camera preview, then try again.");
      return;
    }
    setSnapBusy(true);
    pushDebug("capture frame decode");
    try {
      const full = fullFrameCanvas(video);
      let text = await tryDecodeCanvas(reader, full);
      if (!text) {
        const band = cropBandFromVideo(video);
        text = await tryDecodeCanvas(reader, band);
      }
      if (!text) {
        setStatus("No barcode found in this frame. Move closer and try again.");
        pushDebug("snap: no decode");
        return;
      }
      onDecoded(text);
    } finally {
      setSnapBusy(false);
    }
  }

  function addManual() {
    const text = normalizeImei(manualImei);
    if (text.length < 10) {
      setStatus("Enter a valid IMEI (at least 10 digits).");
      return;
    }
    onDecoded(text);
    setManualImei("");
  }

  async function submit() {
    setStatus(null);
    if (!props.cug?.trim()) {
      props.onNeedSettings();
      return;
    }

    setSubmitting(true);
    try {
      const saved: ScanRecord[] = [];
      for (const imei of session) {
        saved.push(await addScan({ cug: props.cug, imei, timestamp: new Date().toISOString() }));
      }
      setSession([]);

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

  const hint = useMemo(
    () => (
      <div className="text-xs text-[rgb(var(--muted))]">
        Hold steady over the thin barcode. If live scan fails, use <span className="font-semibold text-[rgb(var(--fg))]">Capture frame</span> or
        type the IMEI below.
      </div>
    ),
    [],
  );

  const sessionCount = session.length;

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

      {canScan && lastOk ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">Last scanned</div>
          <div className="mt-1 font-mono text-lg font-semibold tracking-tight">{lastOk}</div>
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

        <div
          className={[
            "relative overflow-hidden rounded-xl border bg-black transition-[box-shadow]",
            flash ? "border-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.35)]" : "border-[rgb(var(--border))]",
          ].join(" ")}
        >
          <video
            ref={videoRef}
            className="h-[min(52vh,360px)] w-full object-cover"
            muted
            playsInline
            autoPlay
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-36 w-[88%] rounded-2xl border border-airtel-red/70 bg-airtel-red/5">
              <div className="absolute left-1/2 top-1/2 h-[2px] w-[80%] -translate-x-1/2 -translate-y-1/2 bg-airtel-red/60" />
            </div>
          </div>

          {!cameraReady && canScan ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-4 text-center text-xs text-white/90">
              Waiting for camera preview… If this stays, tap <span className="font-semibold">Start camera</span> below.
            </div>
          ) : null}
        </div>

        <div className="mt-3 space-y-3">
          {hint}
          {status ? <div className="text-xs text-amber-200/90">{status}</div> : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => startScanner().catch((e) => setStatus(e instanceof Error ? e.message : "Camera failed"))}
              className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm font-semibold"
            >
              Start camera
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

          <button
            type="button"
            disabled={snapBusy}
            onClick={() => captureFrameDecode()}
            className="w-full rounded-xl border border-airtel-red/50 bg-airtel-red/10 px-3 py-2 text-sm font-semibold text-airtel-red disabled:opacity-50"
          >
            {snapBusy ? "Decoding frame…" : "Capture frame (if live scan misses)"}
          </button>

          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3">
            <div className="text-xs font-semibold text-[rgb(var(--muted))]">Add IMEI manually</div>
            <div className="mt-2 flex gap-2">
              <input
                value={manualImei}
                onChange={(e) => setManualImei(e.target.value)}
                inputMode="numeric"
                placeholder="Digits from label"
                className="min-w-0 flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 font-mono text-sm outline-none focus:border-airtel-red"
              />
              <button
                type="button"
                onClick={addManual}
                className="shrink-0 rounded-lg bg-[rgb(var(--card))] px-3 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--border))]"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3">
          <div>
            <div className="text-sm font-semibold">This session</div>
            <div className="text-xs text-[rgb(var(--muted))]">
              {sessionCount === 0 ? "Nothing captured yet — scan, capture frame, or type IMEI." : "Ready to submit when you are."}
            </div>
          </div>
          {sessionCount > 0 ? (
            <button
              type="button"
              onClick={() => setSession([])}
              className="text-xs font-semibold text-airtel-red"
            >
              Clear
            </button>
          ) : null}
        </div>
        {sessionCount > 0 ? (
          <ol className="max-h-56 space-y-2 overflow-y-auto px-4 py-3">
            {session.map((imei, idx) => (
              <li key={imei} className="flex items-baseline gap-3">
                <div className="w-6 text-xs text-[rgb(var(--muted))]">{idx + 1}.</div>
                <div className="font-mono text-sm">{imei}</div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="px-4 py-6 text-center text-xs text-[rgb(var(--muted))]">Session list is empty.</div>
        )}
      </div>

      {debugEnabled ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="text-xs font-semibold text-amber-200">Scanner debug</div>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto font-mono text-[10px] leading-relaxed text-[rgb(var(--muted))]">
            {debugLines.length === 0 ? <div className="text-[rgb(var(--muted))]">Logs appear here while you scan.</div> : null}
            {debugLines.map((l, i) => (
              <div key={`${i}-${l}`}>{l}</div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-amber-200 underline"
            onClick={() => {
              void navigator.clipboard?.writeText(debugLines.join("\n"));
              pushDebug("copied debug log to clipboard");
            }}
          >
            Copy log
          </button>
        </div>
      ) : null}
    </div>
  );
}
