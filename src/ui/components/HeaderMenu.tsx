import { useEffect, useRef, useState } from "react";

export function HeaderMenu(props: {
  onGoScan: () => void;
  onGoHistory: () => void;
  onGoSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))] active:scale-[0.98]"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-[rgb(var(--fg))]" />
          <span className="h-1 w-1 rounded-full bg-[rgb(var(--fg))]" />
          <span className="h-1 w-1 rounded-full bg-[rgb(var(--fg))]" />
        </div>
      </button>

      {open ? (
        <div
          ref={popRef}
          role="menu"
          className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 active:bg-white/10"
            onClick={() => {
              setOpen(false);
              props.onGoScan();
            }}
          >
            Scan
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 active:bg-white/10"
            onClick={() => {
              setOpen(false);
              props.onGoHistory();
            }}
          >
            History
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 active:bg-white/10"
            onClick={() => {
              setOpen(false);
              props.onGoSettings();
            }}
          >
            Settings
          </button>
        </div>
      ) : null}
    </div>
  );
}

