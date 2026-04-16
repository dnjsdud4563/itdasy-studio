// 인앱 리뷰 프롬프트 타이밍 컨트롤러
// 조건: 월 1회 이하, 긍정 이벤트(AI 생성 성공) 직후, 최소 2회 이상 성공 이력.

const KEY_LAST = '@beauty/rating_last';
const KEY_COUNT = '@beauty/rating_events';

type Store = {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
};

let _store: Store | null = null;
export function configureRatingStore(s: Store) { _store = s; }

async function store(): Promise<Store> {
  if (_store) return _store;
  try {
    const ss = await import('expo-secure-store');
    return { getItem: (k) => ss.getItemAsync(k), setItem: (k, v) => ss.setItemAsync(k, v) };
  } catch {
    const mem = new Map<string, string>();
    return { getItem: async (k) => mem.get(k) ?? null, setItem: async (k, v) => { mem.set(k, v); } };
  }
}

export const rating = {
  async recordPositiveEvent() {
    const s = await store();
    const n = Number((await s.getItem(KEY_COUNT)) ?? '0') + 1;
    await s.setItem(KEY_COUNT, String(n));
  },

  async promptIfAppropriate(present: () => Promise<void>) {
    const s = await store();
    const count = Number((await s.getItem(KEY_COUNT)) ?? '0');
    if (count < 2) return false;
    const lastRaw = await s.getItem(KEY_LAST);
    const last = lastRaw ? Number(lastRaw) : 0;
    if (Date.now() - last < 30 * 24 * 3600 * 1000) return false;
    await present();
    await s.setItem(KEY_LAST, String(Date.now()));
    return true;
  },
};
