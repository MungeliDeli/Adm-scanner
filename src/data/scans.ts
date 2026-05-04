import { getDb, type ScanRecord, type ScanStatus } from "./db";

export function nowIso() {
  return new Date().toISOString();
}

export async function addScan(input: { cug: string; imei: string; timestamp?: string }): Promise<ScanRecord> {
  const db = await getDb();
  const rec: ScanRecord = {
    id: crypto.randomUUID(),
    cug: input.cug.trim(),
    imei: input.imei.trim(),
    timestamp: input.timestamp ?? nowIso(),
    status: "queued",
    createdAt: nowIso(),
  };
  await db.put("scans", rec);
  return rec;
}

export async function listScans(limit = 1000): Promise<ScanRecord[]> {
  const db = await getDb();
  const all = await db.getAll("scans");
  all.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return all.slice(0, limit);
}

export async function listByStatus(status: ScanStatus): Promise<ScanRecord[]> {
  const db = await getDb();
  const idx = db.transaction("scans").store.index("by-status");
  const all = await idx.getAll(status);
  all.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return all;
}

export async function markSent(ids: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("scans", "readwrite");
  for (const id of ids) {
    const rec = await tx.store.get(id);
    if (!rec) continue;
    rec.status = "sent";
    rec.error = undefined;
    rec.sentAt = nowIso();
    await tx.store.put(rec);
  }
  await tx.done;
}

export async function markError(ids: string[], message: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("scans", "readwrite");
  for (const id of ids) {
    const rec = await tx.store.get(id);
    if (!rec) continue;
    rec.status = "error";
    rec.error = message;
    await tx.store.put(rec);
  }
  await tx.done;
}

