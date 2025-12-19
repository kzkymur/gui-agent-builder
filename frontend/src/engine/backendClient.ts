import createClient from 'openapi-fetch';
import type { paths } from './__generated__/backend';

// Base URL resolution: Vite env or default local dev port for FastAPI
const BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:8000';

export const backendClient = createClient<paths>({ baseUrl: BASE_URL });

export function setBackendBaseUrl(url: string) {
  // openapi-fetch doesn't expose a setter; make a new client
  return createClient<paths>({ baseUrl: url });
}

