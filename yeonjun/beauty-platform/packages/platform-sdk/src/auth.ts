import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { getOptions, setAccessToken, getAccessToken } from './client';

let _sb: SupabaseClient | null = null;

function sb(): SupabaseClient {
  if (_sb) return _sb;
  const opts = getOptions();
  _sb = createClient(opts.baseUrl.replace(/\/$/, '').replace(/^https:\/\/api\./, 'https://'), opts.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  _sb.auth.onAuthStateChange((_event, session) => {
    setAccessToken(session?.access_token ?? null);
  });
  return _sb;
}

async function syncSession(session: Session | null) {
  setAccessToken(session?.access_token ?? null);
}

export const auth = {
  isSignedIn(): boolean {
    return getAccessToken() !== null;
  },

  async signInWithApple(idToken: string, nonce?: string) {
    const { data, error } = await sb().auth.signInWithIdToken({ provider: 'apple', token: idToken, nonce });
    if (error) throw error;
    await syncSession(data.session);
    return data.session;
  },

  async signInWithGoogle(idToken: string, nonce?: string) {
    const { data, error } = await sb().auth.signInWithIdToken({ provider: 'google', token: idToken, nonce });
    if (error) throw error;
    await syncSession(data.session);
    return data.session;
  },

  async signInWithKakao(idToken: string) {
    // Supabase Kakao OAuth는 브라우저 리다이렉트 방식. 네이티브는 id_token 지원 검증 필요.
    const { data, error } = await sb().auth.signInWithIdToken({ provider: 'kakao' as never, token: idToken });
    if (error) throw error;
    await syncSession(data.session);
    return data.session;
  },

  async signOut() {
    await sb().auth.signOut();
    setAccessToken(null);
  },

  async restore() {
    const { data } = await sb().auth.getSession();
    await syncSession(data.session);
    return data.session;
  },
};
