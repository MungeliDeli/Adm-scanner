import { getDb } from "./db";

export type AppSettings = {
  cug?: string;
  scannerDebug?: boolean;
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const s = await db.get("kv", "settings");
  return { cug: s?.cug, scannerDebug: s?.scannerDebug };
}

export async function saveSettings(input: { cug?: string; scannerDebug?: boolean }): Promise<void> {
  const db = await getDb();
  const prev = (await db.get("kv", "settings")) ?? { id: "settings" as const };
  await db.put("kv", {
    id: "settings",
    cug: input.cug !== undefined ? input.cug.trim() || undefined : prev.cug,
    scannerDebug: input.scannerDebug !== undefined ? input.scannerDebug : prev.scannerDebug,
  });
  window.dispatchEvent(new CustomEvent("adm-settings-changed"));
}

