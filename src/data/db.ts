import { openDB, type DBSchema } from "idb";

export type ScanStatus = "queued" | "sent" | "error";

export type ScanRecord = {
  id: string;
  cug: string;
  imei: string;
  timestamp: string; // ISO string
  status: ScanStatus;
  error?: string;
  createdAt: string; // ISO string
  sentAt?: string; // ISO string
};

type SettingsRecord = {
  id: "settings";
  cug?: string;
  scannerDebug?: boolean;
};

interface AdmScannerDb extends DBSchema {
  scans: {
    key: string;
    value: ScanRecord;
    indexes: { "by-timestamp": string; "by-status": ScanStatus; "by-cug": string };
  };
  kv: {
    key: string;
    value: SettingsRecord;
  };
}

export async function getDb() {
  return openDB<AdmScannerDb>("adm-scanner-db", 1, {
    upgrade(db) {
      const scans = db.createObjectStore("scans", { keyPath: "id" });
      scans.createIndex("by-timestamp", "timestamp");
      scans.createIndex("by-status", "status");
      scans.createIndex("by-cug", "cug");

      db.createObjectStore("kv", { keyPath: "id" });
    },
  });
}

