import { getDb } from "./db";

export async function getSettings(): Promise<{ cug?: string }> {
  const db = await getDb();
  const s = await db.get("kv", "settings");
  return { cug: s?.cug };
}

export async function saveSettings(input: { cug?: string }): Promise<void> {
  const db = await getDb();
  await db.put("kv", { id: "settings", cug: input.cug?.trim() || undefined });
}

