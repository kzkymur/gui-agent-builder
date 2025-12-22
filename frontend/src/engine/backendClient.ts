import createClient from "openapi-fetch";
import type { paths } from "./__generated__/backend";

// Base URL resolution: Vite env or default local dev port for FastAPI
function envVar(key: string): string | undefined {
  try {
    return (import.meta as unknown as { env?: Record<string, string> }).env?.[key];
  } catch {
    return undefined;
  }
}
const BASE_URL = envVar("VITE_BACKEND_URL") || "http://localhost:8000";

let client = createClient<paths>({ baseUrl: BASE_URL });

export function getBackendClient() {
  return client;
}

export function setBackendBaseUrl(url: string) {
  client = createClient<paths>({ baseUrl: url });
}

// Lightweight escape hatch for endpoints not in the OpenAPI types yet
export async function rawGet<T = unknown>(path: string): Promise<T> {
  const base = envVar("VITE_BACKEND_URL") || "http://localhost:8000";
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}
