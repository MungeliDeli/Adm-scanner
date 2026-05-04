type CreateDeviceRecord = { cug: string; imei: string; timestamp?: string };

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export async function postDeviceRecords(records: CreateDeviceRecord[]): Promise<Response> {
  return fetch(`${API_BASE}/api/imeis/device-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(records),
  });
}

