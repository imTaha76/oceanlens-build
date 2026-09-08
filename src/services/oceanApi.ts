/**
 * OCEANLENS - Real Copernicus Ocean Data API Client
 * Connects directly to FastAPI backend service
 */

import { OceanMetadata, OceanSlice } from '../types';

// Default FastAPI backend URL
const DEFAULT_API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  'http://127.0.0.1:8000';

let activeApiUrl: string =
  typeof window !== 'undefined'
    ? localStorage.getItem('oceanlens_api_url') || DEFAULT_API_URL
    : DEFAULT_API_URL;

let lastRequestUrl: string = `${DEFAULT_API_URL}/slice?variable=thetao&depth=0.5&time_index=0`;

export function getLastApiRequestUrl(): string {
  return lastRequestUrl;
}

export function getApiBaseUrl(): string {
  return activeApiUrl;
}

export function setApiBaseUrl(newUrl: string): void {
  // Normalize URL (strip trailing slash)
  const cleanUrl = newUrl.trim().replace(/\/+$/, '');
  activeApiUrl = cleanUrl;
  if (typeof window !== 'undefined') {
    localStorage.setItem('oceanlens_api_url', cleanUrl);
  }
}

export class OceanApiError extends Error {
  public isBackendUnavailable: boolean;
  public endpoint: string;
  public status?: number;

  constructor(message: string, endpoint: string, isBackendUnavailable = true, status?: number) {
    super(message);
    this.name = 'OceanApiError';
    this.endpoint = endpoint;
    this.isBackendUnavailable = isBackendUnavailable;
    this.status = status;
  }
}

/**
 * Pings the backend to check if FastAPI server is responsive
 */
export async function checkBackendHealth(customUrl?: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const url = customUrl || activeApiUrl;
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${url}/metadata`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Math.round(performance.now() - start);

    if (res.ok) {
      return { ok: true, latencyMs };
    } else {
      return {
        ok: false,
        latencyMs,
        error: `Server responded with HTTP status ${res.status}: ${res.statusText}`,
      };
    }
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, latencyMs, error: msg };
  }
}

/**
 * Fetches dataset metadata from FastAPI GET /metadata
 */
export async function getMetadata(): Promise<OceanMetadata> {
  const url = `${activeApiUrl}/metadata`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new OceanApiError(
        `Failed to fetch ocean metadata from ${url} (HTTP ${res.status}: ${res.statusText})`,
        '/metadata',
        false,
        res.status
      );
    }

    const data: OceanMetadata = await res.json();

    // Validate required fields
    if (!data.variables || !Array.isArray(data.depths) || !Array.isArray(data.times)) {
      throw new OceanApiError(
        'Invalid metadata format received from FastAPI backend.',
        '/metadata',
        false
      );
    }

    return data;
  } catch (err: unknown) {
    if (err instanceof OceanApiError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new OceanApiError(
      `OceanLens backend unavailable — unable to load real ocean data: ${msg}`,
      '/metadata',
      true
    );
  }
}

/**
 * Fetches a single 2D ocean slice from FastAPI GET /slice
 * Example: GET /slice?variable=thetao&depth=50&time_index=0
 */
export async function getOceanSlice(
  variable: string,
  depth: number,
  timeIndex: number
): Promise<OceanSlice> {
  const query = new URLSearchParams({
    variable,
    depth: String(depth),
    time_index: String(timeIndex),
  });
  const url = `${activeApiUrl}/slice?${query.toString()}`;
  lastRequestUrl = url;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new OceanApiError(
        `Failed to fetch ocean slice for ${variable} at depth ${depth}m (HTTP ${res.status}: ${res.statusText})`,
        '/slice',
        false,
        res.status
      );
    }

    const data: OceanSlice = await res.json();

    if (!Array.isArray(data.latitude) || !Array.isArray(data.longitude) || !Array.isArray(data.values)) {
      throw new OceanApiError(
        'Invalid slice data structure received from FastAPI backend.',
        '/slice',
        false
      );
    }

    return data;
  } catch (err: unknown) {
    if (err instanceof OceanApiError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new OceanApiError(
      `OceanLens backend unavailable — unable to load real ocean data: ${msg}`,
      '/slice',
      true
    );
  }
}

/**
 * Fetches vertical depth column for a specific coordinate
 * Attempts FastAPI backend /model/column, fallback to embedded Copernicus engine
 */
export async function getModelColumn(
  lat: number,
  lon: number,
  timeIndex: number,
  variable: string = 'thetao'
): Promise<any> {
  const query = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    time_index: String(timeIndex),
    variable,
  });
  const url = `${activeApiUrl}/model/column?${query.toString()}`;
  lastRequestUrl = url;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Graceful fallback to client-side model engine
  }
  return null;
}
