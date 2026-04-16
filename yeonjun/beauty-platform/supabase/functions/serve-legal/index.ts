// 개인정보처리방침·이용약관 정적 HTML 서빙
// URL: /functions/v1/serve-legal?doc=privacy&lang=ko
// Apple/Google/Meta에 이 URL 등록

const DOCS: Record<string, Record<string, string>> = {
  privacy: {
    ko: `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>개인정보처리방침 - Beauty Platform</title><style>body{font-family:-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:20px;line-height:1.7;color:#333}h1{font-size:1.5em}h2{font-size:1.2em;margin-top:2em;border-bottom:1px solid #eee;padding-bottom:8px}</style></head><body>
<h1>개인정보처리방침</h1><p>시행일: 2026-04-16</p>
<h2>1. 수집 항목</h2><p>필수: 이메일, OAuth 식별자, 닉네임<br>선택: 실명, 휴대폰 번호 (AES-256 GCM 암호화 저장)<br>자동: 접속 IP(해시), User-Agent, 접근 경로/시각<br>Instagram 연동 시: 사용자명, 프로필 사진, 미디어 피드</p>
<h2>2. 이용 목적</h2><p>회원 식별, 서비스 제공, 결제 관리, 부정 이용 방지, 법적 의무 이행, Instagram 피드 표시</p>
<h2>3. 보유 및 파기</h2><p>계정 정보: 탈퇴 요청 후 30일 유예 → 완전 파기<br>접속 로그: 통신비밀보호법에 따라 90일 보관 후 자동 파기<br>결제 기록: 전자상거래법에 따라 5년<br>Instagram 데이터: 연동 해제 시 즉시 삭제</p>
<h2>4. 제3자 제공</h2><p>Supabase (인증·DB), Meta Platforms (Instagram API), AI 이미지 생성 서비스, RevenueCat / PortOne (결제)</p>
<h2>5. 이용자 권리</h2><p>열람·정정·삭제·처리정지 요구권. 앱 내 "데이터 내보내기" 및 "계정 삭제" 기능 제공.</p>
<h2>6. 개인정보 보호책임자</h2><p>이메일: privacy@beauty-platform.example.com</p>
</body></html>`,
    en: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy Policy - Beauty Platform</title><style>body{font-family:-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:20px;line-height:1.7;color:#333}h1{font-size:1.5em}h2{font-size:1.2em;margin-top:2em;border-bottom:1px solid #eee;padding-bottom:8px}</style></head><body>
<h1>Privacy Policy</h1><p>Effective: April 16, 2026</p>
<h2>1. Data We Collect</h2><p>Required: Email, OAuth ID, nickname<br>Optional: Real name, phone (AES-256 GCM encrypted)<br>Automatic: Hashed IP, User-Agent, access path/time<br>Instagram (if connected): Username, profile picture, media feed</p>
<h2>2. How We Use Data</h2><p>Account identification, service delivery, payment management, fraud prevention, legal compliance, Instagram feed display.</p>
<h2>3. Retention & Deletion</h2><p>Account: 30-day grace → permanent deletion<br>Access logs: 90 days (Korean Telecom Act) → auto-purge<br>Payment records: 5 years (E-Commerce Act)<br>Instagram data: Deleted on disconnect</p>
<h2>4. Third Parties</h2><p>Supabase, Meta Platforms (Instagram API), AI image services, RevenueCat / PortOne</p>
<h2>5. Your Rights</h2><p>Access, correct, delete, export your data. In-app features provided.</p>
<h2>6. Contact</h2><p>privacy@beauty-platform.example.com</p>
</body></html>`,
  },
  terms: {
    ko: `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>이용약관 - Beauty Platform</title><style>body{font-family:-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:20px;line-height:1.7;color:#333}h1{font-size:1.5em}h2{font-size:1.2em;margin-top:2em;border-bottom:1px solid #eee;padding-bottom:8px}</style></head><body>
<h1>이용약관</h1><p>시행일: 2026-04-16</p>
<h2>1. 서비스 개요</h2><p>AI 이미지 생성·메이크업 시뮬·Instagram 연동 기능을 제공하는 모바일/웹 서비스입니다.</p>
<h2>2. 계정</h2><p>만 14세 이상, 1인 1계정, 타인 명의 도용 금지.</p>
<h2>3. 유료 서비스</h2><p>Apple/Google 인앱결제 또는 PortOne(웹). 크레딧 환불 불가.</p>
<h2>4. Instagram 연동</h2><p>사용자 동의 하에 IG 피드 조회 및 스토리/게시물 공유 가능. 언제든 해제 가능.</p>
<h2>5. 금지 행위</h2><p>타인 이미지 무단 업로드, 불법 프롬프트, 어뷰징, 리버스 엔지니어링.</p>
<h2>6. 면책</h2><p>대한민국 법률 적용, 서울중앙지방법원 관할.</p>
</body></html>`,
    en: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terms of Service - Beauty Platform</title><style>body{font-family:-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:20px;line-height:1.7;color:#333}h1{font-size:1.5em}h2{font-size:1.2em;margin-top:2em;border-bottom:1px solid #eee;padding-bottom:8px}</style></head><body>
<h1>Terms of Service</h1><p>Effective: April 16, 2026</p>
<h2>1. Service</h2><p>AI image generation, makeup simulation, and Instagram integration.</p>
<h2>2. Account</h2><p>14+ years old. One account per person.</p>
<h2>3. Payments</h2><p>Apple/Google IAP or PortOne (web). Credits non-refundable.</p>
<h2>4. Instagram</h2><p>Feed viewing and story/post sharing with user consent. Disconnect anytime.</p>
<h2>5. Prohibited</h2><p>Unauthorized uploads, illegal prompts, abuse, reverse engineering.</p>
<h2>6. Jurisdiction</h2><p>Republic of Korea, Seoul Central District Court.</p>
</body></html>`,
  },
  deletion: {
    ko: `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>데이터 삭제 확인</title></head><body><h1>데이터 삭제 처리 완료</h1><p>요청하신 Instagram 연동 데이터가 삭제되었습니다.</p></body></html>`,
    en: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Data Deletion Confirmation</title></head><body><h1>Data Deletion Complete</h1><p>Your Instagram connection data has been deleted.</p></body></html>`,
  },
};

Deno.serve((req) => {
  const url = new URL(req.url);
  const doc = url.searchParams.get('doc') ?? 'privacy';
  const lang = url.searchParams.get('lang') ?? 'ko';
  const html = DOCS[doc]?.[lang] ?? DOCS[doc]?.['ko'] ?? '<h1>Not Found</h1>';
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
