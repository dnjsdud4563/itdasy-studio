import type { InitOptions } from './types';

let _opts: InitOptions | null = null;
let _accessToken: string | null = null;

export function setOptions(opts: InitOptions) {
  _opts = opts;
}
export function getOptions(): InitOptions {
  if (!_opts) throw new Error('BeautyPlatform.init() must be called first');
  return _opts;
}
export function setAccessToken(token: string | null) {
  _accessToken = token;
}
export function getAccessToken(): string | null {
  return _accessToken;
}

export async function api<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const opts = getOptions();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.auth !== false && _accessToken) {
    headers.Authorization = `Bearer ${_accessToken}`;
  }
  const res = await fetch(`${opts.baseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
