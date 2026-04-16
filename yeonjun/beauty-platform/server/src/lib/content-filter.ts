// UGC 콘텐츠 필터링 — Apple 1.2 / Google UGC 정책
// 비속어 + 성적/폭력 텍스트 사전 차단

const BLOCKED_PATTERNS_KO = [
  /시[0-9]*발/, /씨[0-9]*발/, /ㅅㅂ/, /ㅆㅂ/, /병[0-9]*신/, /ㅂㅅ/,
  /지[0-9]*랄/, /ㅈㄹ/, /개[0-9]*새끼/, /ㄱㅅㄲ/, /꺼[0-9]*져/, /죽어/,
  /성[0-9]*매매/, /야[0-9]*동/, /포[0-9]*르노/,
];

const BLOCKED_PATTERNS_EN = [
  /\bf+u+c+k+/i, /\bs+h+i+t+/i, /\bb+i+t+c+h+/i, /\ba+s+s+h+o+l+e+/i,
  /\bn+i+g+/i, /\bp+o+r+n+/i, /\bs+e+x+u+a+l/i,
];

const ALL_PATTERNS = [...BLOCKED_PATTERNS_KO, ...BLOCKED_PATTERNS_EN];

export function filterText(text: string): { clean: boolean; matched?: string } {
  for (const pattern of ALL_PATTERNS) {
    const match = text.match(pattern);
    if (match) return { clean: false, matched: match[0] };
  }
  return { clean: true };
}

// 향후 확장: HuggingFace NSFW 이미지 분류 모델 연동
export async function filterImage(_imageUrl: string): Promise<{ safe: boolean }> {
  // TODO: HF inference API로 NSFW 분류 (현재는 통과)
  return { safe: true };
}
