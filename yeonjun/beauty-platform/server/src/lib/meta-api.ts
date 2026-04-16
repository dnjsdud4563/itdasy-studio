import { config } from '../config.js';

const GRAPH_URL = 'https://graph.instagram.com';
const AUTH_URL = 'https://api.instagram.com';

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.META_APP_ID,
    redirect_uri: config.META_REDIRECT_URI,
    scope: 'instagram_basic,user_profile,user_media',
    response_type: 'code',
    state,
  });
  return `${AUTH_URL}/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string; userId: string }> {
  const res = await fetch(`${AUTH_URL}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.META_APP_ID,
      client_secret: config.META_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: config.META_REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; user_id: string };
  return { accessToken: data.access_token, userId: data.user_id };
}

export async function getLongLivedToken(shortToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: config.META_APP_SECRET,
    access_token: shortToken,
  });
  const res = await fetch(`${GRAPH_URL}/access_token?${params}`);
  if (!res.ok) throw new Error(`Long-lived token ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function refreshToken(token: string): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token });
  const res = await fetch(`${GRAPH_URL}/refresh_access_token?${params}`);
  if (!res.ok) throw new Error(`Refresh token ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export type IGProfile = {
  id: string;
  username: string;
  account_type: string;
  media_count: number;
  profile_picture_url?: string;
};

export async function getUserProfile(token: string): Promise<IGProfile> {
  const fields = 'id,username,account_type,media_count,profile_picture_url';
  const res = await fetch(`${GRAPH_URL}/me?fields=${fields}&access_token=${token}`);
  if (!res.ok) throw new Error(`Profile ${res.status}: ${await res.text()}`);
  return (await res.json()) as IGProfile;
}

export type IGMedia = {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  thumbnail_url?: string;
  timestamp: string;
  permalink: string;
};

export async function getUserMedia(token: string, limit = 20, after?: string): Promise<{ data: IGMedia[]; nextCursor?: string }> {
  const fields = 'id,caption,media_type,media_url,thumbnail_url,timestamp,permalink';
  const params = new URLSearchParams({ fields, access_token: token, limit: String(limit) });
  if (after) params.set('after', after);
  const res = await fetch(`${GRAPH_URL}/me/media?${params}`);
  if (!res.ok) throw new Error(`Media ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { data: IGMedia[]; paging?: { cursors?: { after?: string } } };
  return { data: body.data, nextCursor: body.paging?.cursors?.after };
}

export function parseSignedRequest(signedRequest: string): { user_id: string } | null {
  const [, payload] = signedRequest.split('.');
  if (!payload) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return decoded as { user_id: string };
  } catch {
    return null;
  }
}
