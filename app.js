// ===== 설정 =====
const API = 'https://apsidal-vance-rateable.ngrok-free.dev';
let _instaHandle = '';

// ===== 유틸 =====
function showToast(msg) {
  const t = document.getElementById('copyToast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function getToken()  { return localStorage.getItem('itdasy_token'); }
function setToken(t) { localStorage.setItem('itdasy_token', t); }
function authHeader() {
  return { 'Authorization': 'Bearer ' + getToken(), 'ngrok-skip-browser-warning': 'true' };
}
function getMyUserId() {
  try {
    return parseInt(JSON.parse(atob(getToken().split('.')[1])).sub);
  } catch { return null; }
}
function isKakaoTalk() { return /KAKAOTALK/i.test(navigator.userAgent); }

function showWelcome(shopName) {
  const overlay = document.getElementById('welcomeOverlay');
  const nameEl  = document.getElementById('welcomeShopName');
  if (!overlay) return;
  if (nameEl) nameEl.textContent = shopName || '사장';
  overlay.classList.add('show');
  setTimeout(() => {
    overlay.classList.add('hide');
    setTimeout(() => overlay.classList.remove('show', 'hide'), 400);
  }, 1800);
}

function showInstallGuide(extraMsg) {
  const el   = document.getElementById('installGuideModal');
  const card = document.getElementById('installGuideCard');
  document.getElementById('installGuideExtra').textContent = extraMsg || '';
  el.style.display = 'flex';
  setTimeout(() => { card.style.transform = 'scale(1)'; card.style.opacity = '1'; }, 10);
}
function hideInstallGuide() {
  const el   = document.getElementById('installGuideModal');
  const card = document.getElementById('installGuideCard');
  card.style.transform = 'scale(0.8)'; card.style.opacity = '0';
  setTimeout(() => { el.style.display = 'none'; }, 300);
}

function handle401() {
  setToken(null);
  document.body.style.transform  = '';
  document.body.style.transition = '';
  document.getElementById('lockOverlay').classList.remove('hidden');
  document.getElementById('sessionExpiredMsg').style.display = 'block';
}

// ===== 업종별 설정 =====
const SHOP_CONFIG = {
  '붙임머리': {
    tagLabel:    '인치 선택',
    treatments:  ['18인치','20인치','22인치','24인치','26인치','28인치','30인치','특수인치','옴브레','재시술'],
    defaultTag:  '24인치',
    baGuide:     '시술 전후 머리 길이 변화를 극명하게 보여주세요. 옆모습 기준이 효과적이에요 💇',
    scriptDefault: '붙임머리 시술 과정',
  },
  '네일아트': {
    tagLabel:    '시술 종류',
    treatments:  ['젤네일','아트네일','아크릴','스컬프처','네일케어','오프','재시술','페디큐어'],
    defaultTag:  '젤네일',
    baGuide:     '손톱 클로즈업으로 Before/After 변화를 선명하게 보여주세요 💅',
    scriptDefault: '네일아트 시술 과정',
  },
};

function applyShopType(type) {
  const cfg = SHOP_CONFIG[type];
  if (!cfg) return;
  const shopName = localStorage.getItem('shop_name') || '사장님';

  // 시술 태그 라벨 & 재빌드
  const lbl = document.getElementById('typeTagLabel');
  if (lbl) lbl.textContent = cfg.tagLabel;
  const container = document.getElementById('typeTags');
  if (container) {
    container.innerHTML = '';
    cfg.treatments.forEach(t => {
      const span = document.createElement('span');
      span.className = 'tag' + (t === cfg.defaultTag ? ' on' : '');
      span.dataset.v = t;
      span.textContent = t;
      container.appendChild(span);
    });
    initSingle('typeTags');
  }

  const baGuide = document.getElementById('baGuideText');
  if (baGuide) baGuide.textContent = cfg.baGuide;
}

// ===== 헤더 프로필 업데이트 =====
function updateHeaderProfile(handle, tone, picUrl) {
  const el = document.getElementById('headerPersona');
  if (el) el.style.display = 'flex';

  const shopName = localStorage.getItem('shop_name') || '사장님';
  const publishLabel = document.getElementById('publishBtnLabel');
  if (publishLabel) publishLabel.textContent = `${shopName} 피드에 바로 올리기`;

  const avatarEl = document.getElementById('headerAvatar');
  if (avatarEl) {
    avatarEl.innerHTML = picUrl
      ? `<img src="${picUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : (shopName[0]?.toUpperCase() || '✨');
  }

  const fh = document.getElementById('frameHandle');
  if (fh && handle) fh.textContent = '@' + handle.replace('@', '');
  const fi = document.getElementById('frameAvatarInner');
  if (fi) {
    fi.innerHTML = picUrl
      ? `<img src="${picUrl}" alt="" style="width:100%;height:100%;object-fit:cover;">`
      : `<span id="frameAvatarLetter">${shopName[0]?.toUpperCase() || '✨'}</span>`;
  }
}

// ===== 온보딩 =====
let obStep = 1, obShopType = '';

function checkOnboarding() {
  if (!localStorage.getItem('onboarding_done')) {
    document.getElementById('onboardingOverlay').classList.remove('hidden');
  } else {
    applyShopType(localStorage.getItem('shop_type') || '');
  }
}

function selectShopType(card) {
  document.querySelectorAll('.ob-shop-card:not(.disabled)').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  obShopType = card.dataset.type;
}

function obShowStep(n) {
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  document.getElementById('ob-step-' + n).classList.add('active');
  document.querySelectorAll('.ob-dot').forEach((d, i) => d.classList.toggle('active', i < n));
  document.getElementById('obBtn').textContent = n === 4 ? '시작하기 🎉' : '계속하기';
  obStep = n;
}

async function obNext() {
  if (obStep === 1) {
    obShowStep(2);
  } else if (obStep === 2) {
    if (!obShopType) {
      document.querySelectorAll('.ob-shop-card:not(.disabled)').forEach(c => {
        c.style.transition = 'transform 0.1s';
        c.style.transform = 'scale(0.96)';
        setTimeout(() => c.style.transform = '', 150);
      });
      return;
    }
    obShowStep(3);
    setTimeout(() => document.getElementById('obShopNameInput').focus(), 300);
  } else if (obStep === 3) {
    const name = document.getElementById('obShopNameInput').value.trim();
    if (!name) {
      document.getElementById('obShopNameInput').style.borderBottomColor = '#E05555';
      setTimeout(() => document.getElementById('obShopNameInput').style.borderBottomColor = '', 1200);
      return;
    }
    localStorage.setItem('shop_name', name);
    document.getElementById('obCompleteName').textContent = name;
    obShowStep(4);
    fetch(API + '/shop/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ shop_name: name })
    }).catch(() => {});
  } else if (obStep === 4) {
    const name = document.getElementById('obShopNameInput').value.trim();
    localStorage.setItem('onboarding_done', '1');
    localStorage.setItem('shop_type', obShopType);
    if (name) localStorage.setItem('shop_name', name);
    document.getElementById('onboardingOverlay').classList.add('hidden');
    applyShopType(obShopType);
    updateHeaderProfile(null, null, null);
  }
}
document.getElementById('obShopNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') obNext(); });

// ===== 스플래시 (iOS PWA) =====
(function initSplash() {
  const isPWA = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (!isPWA) return;
  const splash = document.getElementById('splashScreen');
  if (!splash) return;
  document.body.classList.add('splashing');
  splash.style.display = 'flex';
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => { splash.style.display = 'none'; document.body.classList.remove('splashing'); }, 300);
  }, 2000);
})();

// ===== 설정 바텀시트 =====
function openSettings() {
  const sheet = document.getElementById('settingsSheet');
  const card  = document.getElementById('settingsCard');
  const shopName = localStorage.getItem('shop_name') || '사장님';
  document.getElementById('settingsProfileName').textContent  = shopName;
  document.getElementById('settingsProfileHandle').textContent = _instaHandle ? `@${_instaHandle}` : '인스타 미연동';
  const headerAvatarEl  = document.getElementById('headerAvatar');
  const settingsAvatarEl = document.getElementById('settingsAvatar');
  if (settingsAvatarEl && headerAvatarEl) {
    const img = headerAvatarEl.querySelector('img');
    settingsAvatarEl.innerHTML = img ? `<img src="${img.src}" alt="">` : (headerAvatarEl.textContent || shopName[0] || '잇');
  }
  card.classList.remove('open');
  sheet.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('open')));
}
function closeSettings() {
  const sheet = document.getElementById('settingsSheet');
  const card  = document.getElementById('settingsCard');
  card.classList.remove('open');
  setTimeout(() => { sheet.style.display = 'none'; }, 280);
}
function resetShopSetup() {
  if (!confirm('샵 이름과 종류를 다시 설정할까요?')) return;
  ['shop_name','shop_type','onboarding_done'].forEach(k => localStorage.removeItem(k));
  document.getElementById('onboardingOverlay').classList.remove('hidden');
}
function localReset() {
  if (!confirm('앱을 처음 상태로 초기화할까요?\n(로그인은 유지됩니다)')) return;
  ['itdasy_consented','itdasy_consented_at','itdasy_latest_analysis','onboarding_done','shop_name','shop_type']
    .forEach(k => localStorage.removeItem(k));
  location.reload();
}
function checkCbt1Reset() {
  if (getMyUserId() === 1) {
    const el = document.getElementById('cbt1ResetArea');
    if (el) el.style.display = 'block';
  }
}
async function fullReset() {
  if (!confirm('⚠️ 모든 데이터가 초기화됩니다. 정말 처음부터 시작할까요?')) return;
  try {
    const res = await fetch(API + '/admin/reset', { method: 'POST', headers: authHeader() });
    if (!res.ok) throw new Error('초기화 실패');
    ['itdasy_token','itdasy_consented','itdasy_consented_at','itdasy_latest_analysis','onboarding_done','shop_name','shop_type']
      .forEach(k => localStorage.removeItem(k));
    alert('초기화 완료!');
    location.reload();
  } catch(e) { alert('오류: ' + e.message); }
}
async function logout() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  setToken(null);
  ['itdasy_token','itdasy_consented','itdasy_consented_at','itdasy_latest_analysis'].forEach(k => localStorage.removeItem(k));
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  location.href = 'index.html';
}

// ===== 로그인 =====
async function login() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = document.getElementById('loginBtn');
  const errEl    = document.getElementById('loginError');
  errEl.style.display = 'none';
  if (!email || !password) { errEl.textContent = '이메일과 비밀번호를 입력해주세요.'; errEl.style.display = 'block'; return; }
  btn.textContent = '로그인 중...'; btn.disabled = true;
  try {
    const res  = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || '로그인 실패');
    setToken(data.access_token);
    document.getElementById('lockOverlay').classList.add('hidden');
    checkCbt1Reset();
    checkOnboarding();
    updateHomeGreeting();
    checkInstaStatus(true);
  } catch(e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
  btn.textContent = '로그인'; btn.disabled = false;
}
document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

// URL 토큰 자동 복원
(function() {
  const params = new URLSearchParams(window.location.search);
  const t = params.get('_t');
  if (t) { setToken(decodeURIComponent(t)); history.replaceState(null, '', window.location.pathname); }
})();

// 자동 로그인
if (getToken()) {
  document.getElementById('lockOverlay').classList.add('hidden');
  checkCbt1Reset();
  checkOnboarding();
  updateHomeGreeting();
  checkInstaStatus().then(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'success') {
      history.replaceState(null, '', window.location.pathname);
      setTimeout(runPersonaAnalyze, 800);
    }
    if (params.get('auto_connect') === '1') {
      history.replaceState(null, '', window.location.pathname);
      setTimeout(connectInstagram, 500);
    }
  });
  const consentedAt = localStorage.getItem('itdasy_consented_at');
  const tsEl2 = document.getElementById('consentTimestampDisplay');
  if (tsEl2 && consentedAt) { tsEl2.textContent = `✅ 개인정보 동의 완료 · ${consentedAt}`; tsEl2.style.display = 'inline'; }
}

// ===== 빠른 실행 팝업 =====
function openQuickAction() {
  const popup   = document.getElementById('quickActionPopup');
  const content = popup?.querySelector('.popup-content');
  if (!popup || !content) return;
  popup.style.display = 'flex';
  setTimeout(() => { content.style.transform = 'scale(1)'; content.style.opacity = '1'; }, 10);
}
function closeQuickAction() {
  const popup   = document.getElementById('quickActionPopup');
  const content = popup?.querySelector('.popup-content');
  if (!popup || !content) return;
  content.style.transform = 'scale(0.8)'; content.style.opacity = '0';
  setTimeout(() => { popup.style.display = 'none'; }, 300);
}
function goCaption() { showTab('caption', document.querySelectorAll('.nav-btn')[1]); }

// ===== 인스타그램 연동 =====
async function checkInstaStatus(fromLogin = false) {
  if (!getToken()) return;
  try {
    const res  = await fetch(API + '/instagram/status', { headers: authHeader() });
    if (!res.ok) return;
    const data = await res.json();
    if (fromLogin && data.shop_name) showWelcome(data.shop_name);
    const connectRow = document.getElementById('instaConnectRow');
    if (data.connected) {
      if (connectRow) connectRow.style.display = 'none';
      document.getElementById('privacyConsentWrap').style.display = 'none';
      _instaHandle = data.handle || '';
      updateHeaderProfile(_instaHandle, data.persona?.tone || null, data.profile_picture_url || '');
      if (data.persona) renderPersonaDash(data.persona);
    } else {
      if (connectRow) connectRow.style.display = 'flex';
      const btn = document.getElementById('instaBtn');
      if (btn) { btn.style.display = ''; btn.textContent = '연동하기'; btn.className = 'btn-insta'; btn.style.background = 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)'; btn.onclick = connectInstagram; }
      document.getElementById('privacyConsentWrap').style.display = 'flex';
      document.getElementById('personaDash').style.display = 'none';
    }
  } catch(e) {}
}

function renderPersonaDash(p) {
  document.getElementById('personaDash').style.display = 'block';
  const content = document.getElementById('personaContent');
  if (content) content.textContent = p.tone || '친근하고 공손한 말투';
}

function updateHomeGreeting() {
  const el = document.getElementById('homeGreeting');
  if (!el) return;
  const name = localStorage.getItem('shop_name') || '';
  el.textContent = name ? `${name} 대표님, 안녕하세요` : '대표님, 안녕하세요';
}

function showDetailedAnalysis() {
  const raw = JSON.parse(localStorage.getItem('itdasy_latest_analysis') || '{}');
  if (!raw.tone_summary) { alert('학습된 말투 데이터가 없습니다. 먼저 분석을 진행해주세요!'); return; }
  renderDetailedPopup({ raw_analysis: raw, persona: { avg_caption_length: raw.avg_caption_length || 0, emojis: raw.emojis, hashtags: raw.hashtags, style_summary: raw.style_summary } });
  document.getElementById('analyzeResultPopup').style.display = 'block';
}

function renderDetailedPopup(data) {
  const p    = data.persona;
  const raw  = data.raw_analysis || {};
  const tFeatures = raw.tone_features || raw.tone_traits || [];
  const top5 = raw.top5_analysis || raw.top_5_analysis || raw.top5 || raw.success_highlights || [];
  document.getElementById('analyzeResultBody').innerHTML = `
    <div style="margin-bottom:24px; padding:16px; background:rgba(241,128,145,0.04); border-radius:16px; border:1px solid rgba(241,128,145,0.08);">
      <div style="color:var(--accent2); font-size:11px; font-weight:700; margin-bottom:6px;">분석 데이터 요약</div>
      <div style="font-size:15px; font-weight:700; color:var(--text);">최근 게시물 기준 · 평균 ${p.avg_caption_length}자</div>
    </div>
    <div style="margin-bottom:28px;">
      <div style="color:var(--accent2); font-size:11px; font-weight:700; margin-bottom:10px;">사장님만의 어조 (Tone)</div>
      <div style="font-size:17px; font-weight:800; color:var(--text); margin-bottom:12px; line-height:1.4; word-break:keep-all;">"${raw.tone_summary || p.tone}"</div>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${tFeatures.map(f => `<span style="background:rgba(0,0,0,0.03); color:var(--text2); padding:6px 12px; border-radius:20px; font-size:12px; font-weight:500;">${f}</span>`).join('')}
      </div>
    </div>
    <div style="margin-bottom:32px;">
      <div style="color:var(--accent2); font-size:11px; font-weight:700; margin-bottom:12px;">인기 비결 TOP 5</div>
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${top5.length > 0 ? top5.map(item => `
          <div style="background:white; border-radius:14px; padding:16px; border:1px solid rgba(0,0,0,0.04); box-shadow:0 4px 12px rgba(0,0,0,0.02); display:flex; gap:12px; align-items:flex-start;">
            <div style="width:24px; height:24px; background:var(--accent2); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:900; flex-shrink:0;">${item.rank}</div>
            <div style="font-size:13px; color:var(--text); line-height:1.5; font-weight:500; word-break:keep-all;">${item.why}</div>
          </div>`).join('') : '<div style="font-size:13px; color:var(--text3); text-align:center; padding:20px; background:#f9f9f9; border-radius:14px;">인기 비결 데이터 분석 중입니다.</div>'}
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px;">
      <div style="padding:16px; background:#f9f9f9; border-radius:16px;">
        <div style="color:var(--text3); font-size:10px; font-weight:700; margin-bottom:8px;">자주 쓰는 이모지</div>
        <div style="font-size:16px; letter-spacing:3px; word-break:break-all;">${p.emojis || '✨'}</div>
      </div>
      <div style="padding:16px; background:#f9f9f9; border-radius:16px; overflow:hidden;">
        <div style="color:var(--text3); font-size:10px; font-weight:700; margin-bottom:8px;">자주 쓰는 해시태그</div>
        <div style="font-size:11px; color:var(--accent); line-height:1.6; word-break:break-all;">${(p.hashtags || '#잇데이').replace(/,/g, ' ')}</div>
      </div>
    </div>
    <div style="padding:24px; background:linear-gradient(135deg, #fffcfd, #fff5f7); border-radius:24px; border:1.5px solid rgba(241,128,145,0.2);">
      <div style="color:var(--accent2); font-size:11px; font-weight:700; margin-bottom:10px;">필승 글쓰기 전략</div>
      <div style="font-size:14px; font-weight:700; color:var(--text); line-height:1.7; word-break:keep-all;">" ${raw.style_summary || p.style_summary || '대표님의 감성을 살린 글쓰기를 추천드려요.'} "</div>
    </div>`;
}

function reAnalyzePersona() {
  if (confirm('최신 게시물들을 바탕으로 다시 분석하시겠습니까?')) runPersonaAnalyze();
}

async function runPersonaAnalyze() {
  const overlay = document.getElementById('analyzeOverlay');
  const bar     = document.getElementById('analyzeProgressBar');
  const stepTxt = document.getElementById('analyzeStepText');
  const subTxt  = document.getElementById('analyzeSubText');
  const steps   = [
    { pct: 10, text: '게시물 수집 중...',       sub: '최근 30개 게시물을 가져오고 있어요' },
    { pct: 35, text: '말투 분석 중...',          sub: '사장님만의 문체 패턴을 파악하는 중' },
    { pct: 55, text: '해시태그 패턴 분석 중...', sub: '자주 쓰신 해시태그 top20 추출 중' },
    { pct: 75, text: '인기 게시물 특징 분석 중...', sub: '좋아요·댓글 많은 게시물의 공통점 파악 중' },
    { pct: 90, text: '말투 데이터 완성 중...',   sub: 'AI가 분석 결과를 정리하고 있어요' },
  ];
  overlay.style.display = 'flex';
  let stepIdx = 0;
  const ticker = setInterval(() => {
    if (stepIdx < steps.length) {
      const s = steps[stepIdx++];
      bar.style.width = s.pct + '%'; stepTxt.textContent = s.text; subTxt.textContent = s.sub;
    }
  }, 2200);
  try {
    const res = await fetch(API + '/instagram/analyze', { method: 'POST', headers: authHeader() });
    clearInterval(ticker);
    if (!res.ok) { const err = await res.json(); overlay.style.display = 'none'; alert('분석 실패: ' + (err.detail || '알 수 없는 오류')); return; }
    const data = await res.json();
    const p    = data.persona;
    const raw  = data.raw_analysis || {};
    localStorage.setItem('itdasy_latest_analysis', JSON.stringify({ ...raw, avg_caption_length: p.avg_caption_length, emojis: p.emojis, hashtags: p.hashtags, style_summary: p.style_summary }));
    bar.style.width = '100%'; stepTxt.textContent = '분석 성공! 🎉'; subTxt.textContent = '말투 데이터가 업데이트됐어요';
    const curPic = document.getElementById('headerAvatar').querySelector('img')?.src || '';
    updateHeaderProfile(_instaHandle, p.tone, curPic);
    renderPersonaDash(p);
    setTimeout(() => { overlay.style.display = 'none'; renderDetailedPopup(data); document.getElementById('analyzeResultPopup').style.display = 'block'; }, 800);
  } catch(e) {
    clearInterval(ticker); overlay.style.display = 'none'; alert('분석 오류: ' + e.message);
  }
}

async function connectInstagram() {
  if (!getToken()) { document.getElementById('lockOverlay').classList.remove('hidden'); return; }
  const btn   = document.getElementById('instaBtn');
  const isPWA = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isKakaoTalk()) { showInstallGuide('카카오톡 내부 브라우저에서는 인스타 연동이 안 됩니다.'); return; }
  if (isIOS && !isPWA) { showInstallGuide(); return; }
  btn.textContent = '연결 중...'; btn.disabled = true;
  try {
    fetch(API + '/instagram/consent', { method: 'POST', headers: authHeader() })
      .then(() => {
        const now = new Date().toLocaleString('ko-KR');
        localStorage.setItem('itdasy_consented', 'true');
        localStorage.setItem('itdasy_consented_at', now);
        const tsEl = document.getElementById('consentTimestampDisplay');
        if (tsEl) { tsEl.textContent = `✅ 동의 완료: ${now}`; tsEl.style.display = 'block'; }
      }).catch(() => {});
    window.location.href = `${API}/instagram/go?token=${encodeURIComponent(getToken())}`;
  } catch(e) {
    alert('연동 오류: ' + e.message);
    btn.textContent = '연동하기'; btn.disabled = false;
  }
}

async function disconnectInstagram() {
  if (!confirm('인스타 연동을 해제하시겠습니까?')) return;
  try {
    await fetch(API + '/instagram/disconnect', { method: 'POST', headers: authHeader() });
    ['itdasy_consented','itdasy_consented_at','itdasy_latest_analysis'].forEach(k => localStorage.removeItem(k));
    const tsEl = document.getElementById('consentTimestampDisplay');
    if (tsEl) tsEl.textContent = '';
    checkInstaStatus();
  } catch(e) { alert('해제 오류: ' + e.message); }
}

// ===== 탭 전환 =====
function showTab(id, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
}

// ===== 태그 초기화 =====
function initSingle(id) {
  document.getElementById(id).querySelectorAll('.tag, .style-opt').forEach(t => {
    t.addEventListener('click', () => {
      document.getElementById(id).querySelectorAll('.tag, .style-opt').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
    });
  });
}
function getSel(id) {
  return [...document.getElementById(id).querySelectorAll('.tag.on, .style-opt.on')].map(t => t.dataset.v || t.textContent.trim());
}

// 태그 그룹 초기화
initSingle('typeTags');
document.querySelectorAll('.style-opts').forEach(g => {
  g.querySelectorAll('.style-opt').forEach(t => {
    t.addEventListener('click', () => { g.querySelectorAll('.style-opt').forEach(x => x.classList.remove('on')); t.classList.add('on'); });
  });
});

// ===== 캡션 로딩 팝업 =====
let _clTimer = null, _clMsgTimer = null;
function _setCaptionProgress(pct) {
  document.getElementById('clRunner').style.left = Math.min(pct, 96) + '%';
  document.getElementById('clFill').style.width  = Math.min(pct, 100) + '%';
}
function showCaptionLoader() {
  document.getElementById('captionLoadingPopup').style.display = 'flex';
  _setCaptionProgress(0);
  let pct = 0;
  _clTimer = setInterval(() => { pct += (88 - pct) * 0.04; _setCaptionProgress(pct); }, 150);
  const msgs = ['원장님 말투 불러오는 중...','AI가 글 구상 중이에요...','단어 하나하나 고르는 중...','해시태그 골라내는 중...','거의 다 됐어요...'];
  let idx = 0;
  document.getElementById('clMsg').textContent = msgs[0];
  _clMsgTimer = setInterval(() => { idx = Math.min(idx + 1, msgs.length - 1); document.getElementById('clMsg').textContent = msgs[idx]; }, 1800);
}
function hideCaptionLoader(success) {
  clearInterval(_clTimer); clearInterval(_clMsgTimer);
  _setCaptionProgress(100);
  document.getElementById('clMsg').textContent = success ? '완성됐어요! 🎉' : '오류가 났어요 😢';
  setTimeout(() => { document.getElementById('captionLoadingPopup').style.display = 'none'; _setCaptionProgress(0); }, 450);
}

// ===== 캡션 생성 =====
async function generateCaption() {
  const types    = getSel('typeTags');
  const memo     = document.getElementById('captionMemo').value;
  const ctaType  = getSel('ctaTags')[0] || 'DM';
  const btn      = document.getElementById('captionBtn');
  const shopType = localStorage.getItem('shop_type') || '붙임머리';
  const cfg      = SHOP_CONFIG[shopType] || SHOP_CONFIG['붙임머리'];
  const typeStr  = types.length > 0 ? types.join(', ') : cfg.defaultTag;
  btn.disabled   = true;
  document.getElementById('captionResult').style.display = 'none';
  showCaptionLoader();
  try {
    const res  = await fetch(API + '/caption/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ description: `${shopType} 시술. ${cfg.tagLabel}: ${typeStr}. 업종: ${shopType}. ${memo || ''}${ctaType !== '없음' ? `. 캡션 마지막에 "${ctaType}으로 예약 문의 주세요" 스타일의 예약 CTA를 원장님 말투로 자연스럽게 한 줄 넣어주세요.` : ''}`, platform: 'instagram' })
    });
    if (res.status === 401) { setToken(null); document.getElementById('lockOverlay').classList.remove('hidden'); throw new Error('로그인이 필요합니다.'); }
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || '생성 실패');
    const hashes = Array.isArray(data.hashtags) ? data.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(' ') : data.hashtags;
    document.getElementById('captionText').textContent = data.caption;
    document.getElementById('captionHash').textContent = hashes;
    hideCaptionLoader(true);
    setTimeout(() => { document.getElementById('captionResult').style.display = 'block'; }, 300);
  } catch(e) {
    document.getElementById('captionText').textContent = '오류가 났어요: ' + e.message;
    document.getElementById('captionHash').textContent = '';
    hideCaptionLoader(false);
    setTimeout(() => { document.getElementById('captionResult').style.display = 'block'; }, 300);
  }
  btn.innerHTML = '다시 만들기 ✨'; btn.disabled = false;
}

function copyCaption() { navigator.clipboard.writeText(document.getElementById('captionText').textContent).then(() => showToast('캡션 복사 완료! 📋')); }
function copyAll()     { navigator.clipboard.writeText(document.getElementById('captionText').textContent + '\n\n' + document.getElementById('captionHash').textContent).then(() => showToast('전체 복사 완료! 📋')); }
function flashBtn(btn, msg) { const orig = btn.textContent; btn.textContent = msg; setTimeout(() => btn.textContent = orig, 1500); }

// ===== 인스타 자동 발행 =====
function publishToInstagram() {
  if (!getToken()) { alert('홈 탭에서 인스타 연동을 먼저 진행해주세요!'); return; }
  const canvas       = document.getElementById('baCanvas');
  const editedCaption = document.getElementById('publishCaptionPreview').value.trim();
  const caption      = document.getElementById('captionText').textContent;
  const hash         = document.getElementById('captionHash').textContent;
  const hasCaption   = caption && !caption.includes('생성된 캡션이 여기에 나타납니다');
  const finalText    = editedCaption || (hasCaption ? caption + '\n\n' + hash : '(글 없이 사진만 올라갑니다)');
  const shopName     = localStorage.getItem('shop_name') || '사장님';
  document.getElementById('previewShopName').textContent     = shopName;
  document.getElementById('previewFinalCaption').textContent = finalText;
  document.getElementById('previewFinalImg').src             = canvas.toDataURL('image/png');
  document.getElementById('previewAvatar').innerHTML         = document.getElementById('headerAvatar').innerHTML;
  const pop = document.getElementById('publishPreviewPopup');
  pop.style.display = 'flex';
  setTimeout(() => { pop.querySelector('.popup-content').style.transform = 'scale(1)'; pop.querySelector('.popup-content').style.opacity = '1'; }, 10);
}
function closePublishPreview() {
  const pop = document.getElementById('publishPreviewPopup');
  pop.querySelector('.popup-content').style.transform = 'scale(0.9)';
  pop.querySelector('.popup-content').style.opacity   = '0';
  setTimeout(() => pop.style.display = 'none', 300);
}
function setUploadProgress(pct, msg) {
  document.getElementById('upPct').textContent  = pct + '%';
  document.getElementById('upMsg').textContent  = msg;
  document.getElementById('upFill').style.width = pct + '%';
}
function openInstagramProfile() {
  const handle = (_instaHandle || '').replace('@', '');
  window.location.href = handle ? `instagram://user?username=${handle}` : 'instagram://';
}
function closeUploadDone() { document.getElementById('uploadDonePopup').style.display = 'none'; }

async function doActualPublish() {
  const btn       = document.getElementById('doPublishBtn');
  const finalText = document.getElementById('previewFinalCaption').textContent;
  btn.disabled    = true;
  const upPopup   = document.getElementById('uploadProgressPopup');
  upPopup.style.display = 'flex';
  setUploadProgress(10, '이미지 준비 중...');
  try {
    const canvas   = document.getElementById('baCanvas');
    const blob     = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const formData = new FormData();
    formData.append('image', blob, 'instagram_post.png');
    formData.append('caption', finalText);
    setUploadProgress(40, '서버에 전송 중...');
    const res = await fetch(API + '/instagram/publish', { method: 'POST', headers: { ...authHeader(), 'ngrok-skip-browser-warning': 'true' }, body: formData });
    setUploadProgress(70, '인스타에 업로드 중...');
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || '업로드 실패');
    setUploadProgress(90, '마무리 중...');
    await new Promise(r => setTimeout(r, 500));
    setUploadProgress(100, '완료! 🎉');
    setTimeout(() => {
      upPopup.style.display = 'none'; closePublishPreview();
      document.getElementById('uploadDonePopup').style.display = 'flex';
      for (let i = 0; i < 20; i++) setTimeout(createConfetti, i * 100);
    }, 1500);
  } catch(e) {
    upPopup.style.display = 'none'; showToast('오류: ' + e.message);
    btn.textContent = '다시 시도하기 🚀'; btn.disabled = false;
  }
}

// ===== Before/After =====
const imgs = { before: null, after: null };

function loadImage(input, side) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img    = new Image();
    img.onload   = () => {
      imgs[side] = img;
      const preview = document.getElementById(side + 'Preview');
      const area    = document.getElementById(side + 'Area');
      preview.src   = e.target.result; preview.style.display = 'block'; area.style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderBA() {
  if (!imgs.before || !imgs.after) { alert('Before, After 사진을 모두 선택해주세요!'); return; }
  const layout = document.querySelectorAll('.style-opts .style-opt.on')[0]?.dataset.v || 'side';
  const wm     = document.querySelectorAll('.style-opts .style-opt.on')[1]?.dataset.v || 'wm1';
  const canvas = document.getElementById('baCanvas');
  const ctx    = canvas.getContext('2d');
  const [W, H] = layout === 'top' ? [1080, 1350] : [1080, 1080];
  canvas.width = W; canvas.height = H; canvas.style.display = 'block';
  ctx.fillStyle = '#0f0608'; ctx.fillRect(0, 0, W, H);

  function drawCropped(img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale, sh = h / scale, sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  const PAD = 6;
  if (layout === 'side' || layout === 'square') {
    const hw = (W - PAD * 3) / 2, ih = H - PAD * 2 - 80;
    drawCropped(imgs.before, PAD,        PAD, hw, ih);
    drawCropped(imgs.after,  PAD*2 + hw, PAD, hw, ih);
    const ly = ih + PAD + 10;
    drawLabel(ctx, 'BEFORE',    PAD + hw/2,        ly, W);
    drawLabel(ctx, 'AFTER ✨', PAD*2 + hw + hw/2, ly, W);
  } else {
    const hh = (H - PAD * 3 - 80) / 2;
    drawCropped(imgs.before, PAD, PAD,        W - PAD*2, hh);
    drawCropped(imgs.after,  PAD, PAD*2 + hh, W - PAD*2, hh);
    drawLabel(ctx, 'BEFORE',   W/2, hh + PAD + 14,     W);
    drawLabel(ctx, 'AFTER ✨', W/2, hh*2 + PAD*2 + 14, W);
  }
  if (wm !== 'wm0') {
    const wmText = wm === 'wm1' ? '🎀 @itdasy' : '잇데이 붙임머리';
    ctx.fillStyle = 'rgba(232,160,176,0.9)'; ctx.font = '500 28px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center'; ctx.fillText(wmText, W/2, H - 22);
  }
  // 캡션 미리보기
  const c = document.getElementById('captionText').textContent;
  const h = document.getElementById('captionHash').textContent;
  const previewArea  = document.getElementById('publishConfirmArea');
  const previewInput = document.getElementById('publishCaptionPreview');
  previewArea.style.display = 'block';
  previewInput.value = (c && !c.includes('생성된 캡션이 여기에 나타납니다'))
    ? c + '\n\n' + h
    : '⚠️ 아직 글을 만들지 않으셨어요.\n\n사진만 올라갑니다. 첫 번째 탭에서 글을 먼저 만드시는 걸 추천드려요!';
  document.getElementById('publishArea').style.display = 'block';
  document.getElementById('saveBtn').style.display = 'block';
  document.getElementById('resetBaBtn').style.display = 'block';
}

function drawLabel(ctx, text, x, y, W) {
  ctx.fillStyle = 'rgba(15,6,8,0.7)'; ctx.beginPath();
  ctx.roundRect(x - 70, y - 22, 140, 34, 17); ctx.fill();
  ctx.fillStyle = '#f0e8ea'; ctx.font = '500 18px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center'; ctx.fillText(text, x, y);
}
function saveCanvas() {
  const a = document.createElement('a');
  a.download = 'itdasy_ba_' + Date.now() + '.jpg';
  a.href = document.getElementById('baCanvas').toDataURL('image/jpeg', 0.92);
  a.click();
}
function resetBA() {
  imgs.before = imgs.after = null;
  ['beforePreview','afterPreview'].forEach(id => { document.getElementById(id).style.display = 'none'; });
  ['beforeArea','afterArea'].forEach(id     => { document.getElementById(id).style.display = 'block'; });
  ['baCanvas','saveBtn','resetBaBtn','publishConfirmArea','publishArea'].forEach(id => { document.getElementById(id).style.display = 'none'; });
  document.querySelectorAll('#tab-ba input[type=file]').forEach(i => i.value = '');
}
function createConfetti() {
  const c = document.createElement('div');
  c.textContent = ['🎀','✨','💎','🩷'][Math.floor(Math.random()*4)];
  c.className = 'confetti'; c.style.left = Math.random() * 100 + 'vw';
  c.style.animationDuration = Math.random() * 2 + 3 + 's';
  document.body.appendChild(c); setTimeout(() => c.remove(), 5000);
}

// ===== 잇데이 스타일 편집 =====
let editFile = null, editImg = null;

function loadEditImage(input) {
  const file = input.files[0];
  if (!file) return;
  editFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      editImg = img;
      const prev = document.getElementById('editPreview');
      prev.src = e.target.result; prev.style.display = 'block';
      document.getElementById('editArea').style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function getCloudBg(W, H, colorMode) {
  return new Promise(resolve => {
    if (colorMode.startsWith('cloud')) {
      const isBW = colorMode === 'cloud_bw';
      const img  = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(W / img.width, H / img.height);
        const sw = W/scale, sh = H/scale, sx = (img.width-sw)/2, sy = (img.height-sh)/2;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        if (isBW) {
          const imgData = ctx.getImageData(0, 0, W, H), d = imgData.data;
          for (let i = 0; i < d.length; i += 4) { const g = d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114; d[i] = d[i+1] = d[i+2] = g; }
          ctx.putImageData(imgData, 0, 0);
        }
        const outImg = new Image(); outImg.onload = () => resolve(outImg); outImg.src = canvas.toDataURL();
      };
      img.src = 'cloud.jpeg'; return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (colorMode === 'pink') {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#fce4ec'); grad.addColorStop(1, '#f8bbd0');
      ctx.fillStyle = grad;
    } else { ctx.fillStyle = '#f8f6f4'; }
    ctx.fillRect(0, 0, W, H);
    const imgOut = new Image(); imgOut.onload = () => resolve(imgOut); imgOut.src = canvas.toDataURL();
  });
}

async function renderEdit() {
  if (!editFile) { alert('사진을 먼저 올려주세요!'); return; }
  const bgMode = document.querySelector('#bgOpts .style-opt.on')?.dataset.v || 'cloud_bw';
  const wm     = document.querySelector('#editWmOpts .style-opt.on')?.dataset.v || 'wm1';
  document.getElementById('editBtn').style.display      = 'none';
  document.getElementById('editProgress').style.display = 'block';
  document.getElementById('editCanvas').style.display   = 'none';
  document.getElementById('editSaveBtn').style.display  = 'none';
  document.getElementById('resetEditBtn').style.display = 'none';
  try {
    const formData = new FormData();
    formData.append('file', editFile);
    const res = await fetch(API + '/image/remove-bg', { method: 'POST', headers: authHeader(), body: formData });
    if (res.status === 401) { setToken(null); document.getElementById('lockOverlay').classList.remove('hidden'); throw new Error('로그인이 필요합니다.'); }
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'API 오류 (' + res.status + ')'); }
    const blob      = await res.blob();
    const url       = URL.createObjectURL(blob);
    const personImg = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
    const W = 1080, H = 1350;
    const canvas = document.getElementById('editCanvas');
    const ctx    = canvas.getContext('2d');
    canvas.width = W; canvas.height = H;
    ctx.drawImage(await getCloudBg(W, H, bgMode), 0, 0, W, H);
    const scale = Math.min(W / personImg.width, H / personImg.height) * 0.92;
    const pw = personImg.width * scale, ph = personImg.height * scale;
    ctx.drawImage(personImg, (W - pw) / 2, H - ph - H * 0.02, pw, ph);
    if (wm !== 'wm0') {
      const wmText = '🎀 @itdasy'; const fs = 32;
      ctx.font = `500 ${fs}px "Noto Sans KR", sans-serif`; ctx.textAlign = 'center';
      const tw = ctx.measureText(wmText).width;
      ctx.fillStyle = 'rgba(15,6,8,0.5)'; ctx.beginPath();
      ctx.roundRect(W/2 - tw/2 - 16, H - 56, tw + 32, 42, 21); ctx.fill();
      ctx.fillStyle = 'rgba(232,160,176,0.95)'; ctx.fillText(wmText, W/2, H - 26);
    }
    canvas.style.display = 'block';
    document.getElementById('editSaveBtn').style.display  = 'block';
    document.getElementById('resetEditBtn').style.display = 'block';
    document.getElementById('editProgress').style.display = 'none';
    URL.revokeObjectURL(url);
  } catch(e) { alert('오류: ' + e.message); }
  document.getElementById('editBtn').style.display      = 'block';
  document.getElementById('editProgress').style.display = 'none';
}

function saveEdit() {
  const a = document.createElement('a');
  a.download = 'itdasy_' + Date.now() + '.jpg';
  a.href = document.getElementById('editCanvas').toDataURL('image/jpeg', 0.93);
  a.click();
}
function resetEdit() {
  editFile = editImg = null;
  ['editPreview','editCanvas','editSaveBtn','resetEditBtn','editProgress'].forEach(id => { document.getElementById(id).style.display = ['editPreview','editCanvas'].includes(id) ? 'none' : 'none'; });
  document.getElementById('editPreview').style.display = 'none';
  document.getElementById('editCanvas').style.display  = 'none';
  document.getElementById('editSaveBtn').style.display = 'none';
  document.getElementById('resetEditBtn').style.display = 'none';
  document.getElementById('editProgress').style.display = 'none';
  document.getElementById('editArea').style.display    = 'block';
  document.getElementById('editBtn').style.display     = 'block';
  const input = document.querySelector('#editArea input[type=file]');
  if (input) input.value = '';
}


// ===== 고객 후기 카드 =====
function renderReviewCard() {
  const text  = document.getElementById('reviewText').value.trim();
  const name  = document.getElementById('reviewName').value.trim();
  const style = document.querySelector('#reviewStyleOpts .style-opt.on')?.dataset.v || 'pink';
  if (!text) { showToast('후기 내용을 입력해주세요'); return; }

  const shopName = localStorage.getItem('shop_name') || '잇데이';
  const canvas   = document.getElementById('reviewCanvas');
  const ctx      = canvas.getContext('2d');
  const SIZE     = 1080;
  canvas.width   = SIZE;
  canvas.height  = SIZE;

  // 배경
  const themes = {
    pink:  { bg1: '#FFF0F3', bg2: '#FFD6DF', quote: '#F18091', text: '#2d1f25', sub: '#D95F70', line: 'rgba(241,128,145,0.3)' },
    dark:  { bg1: '#1a1a2e', bg2: '#16213e', quote: '#F18091', text: '#ffffff', sub: '#F18091', line: 'rgba(241,128,145,0.4)' },
    white: { bg1: '#ffffff', bg2: '#f8f8f8', quote: '#D95F70', text: '#1a1a1a', sub: '#888888', line: 'rgba(0,0,0,0.1)' }
  };
  const t = themes[style];

  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, t.bg1);
  grad.addColorStop(1, t.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 상단 라인 장식
  ctx.fillStyle = t.line;
  ctx.fillRect(80, 120, SIZE - 160, 2);

  // 큰따옴표
  ctx.fillStyle = t.quote;
  ctx.font = 'bold 200px serif';
  ctx.textAlign = 'left';
  ctx.globalAlpha = 0.15;
  ctx.fillText('\u201C', 60, 320);
  ctx.globalAlpha = 1;

  // 후기 텍스트 (줄바꿈 처리)
  ctx.fillStyle = t.text;
  ctx.textAlign = 'center';
  const fontSize = text.length > 60 ? 42 : text.length > 30 ? 48 : 54;
  ctx.font = `500 ${fontSize}px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`;
  const words = text.split('');
  const lineWidth = SIZE - 200;
  let line = '', lines = [];
  for (const ch of words) {
    const test = line + ch;
    if (ctx.measureText(test).width > lineWidth && line) { lines.push(line); line = ch; }
    else line = test;
  }
  if (line) lines.push(line);
  const lineH   = fontSize * 1.7;
  const totalH  = lines.length * lineH;
  const startY  = (SIZE - totalH) / 2 + fontSize / 2;
  lines.forEach((l, i) => ctx.fillText(l, SIZE / 2, startY + i * lineH));

  // 하단 라인 장식
  ctx.fillStyle = t.line;
  ctx.fillRect(80, SIZE - 200, SIZE - 160, 2);

  // 고객 이름
  if (name) {
    ctx.fillStyle = t.sub;
    ctx.font = `600 36px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('— ' + name, SIZE / 2, SIZE - 160);
  }

  // 샵 이름 워터마크
  ctx.fillStyle = t.sub;
  ctx.globalAlpha = 0.5;
  ctx.font = `500 28px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(shopName, SIZE / 2, SIZE - 80);
  ctx.globalAlpha = 1;

  canvas.style.display = 'block';
  document.getElementById('reviewSaveBtn').style.display = 'block';
}

function saveReviewCard() {
  const canvas = document.getElementById('reviewCanvas');
  const a = document.createElement('a');
  a.download = '리뷰카드.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
}

// ===== Service Worker =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/itdasy-app/sw.js')
    .then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => { if (nw.state === 'activated') console.log('[SW] 새 버전 적용됨'); });
      });
    }).catch(err => console.warn('[SW] 등록 실패:', err));
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}

// ===== Pull-to-Refresh (iOS PWA) =====
(function initPTR() {
  if (!window.navigator.standalone) return;
  const THRESHOLD = 120, RESISTANCE = 0.4;
  const SPRING    = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
  const LABEL     = document.getElementById('ptrLabel');
  const EMOJI     = document.getElementById('ptrEmoji');
  let startY = 0, pulling = false, triggered = false, loading = false;

  function applyMove(move) { document.body.style.transition = 'none'; document.body.style.transform = `translateY(${move}px)`; }
  function springBack(onDone) {
    document.body.style.transition = SPRING; document.body.style.transform = 'translateY(0)';
    setTimeout(() => { document.body.style.transition = ''; document.body.style.transform = ''; if (onDone) onDone(); }, 500);
  }
  function resetIndicator() { LABEL.textContent = '당겨서 새로고침'; LABEL.style.color = ''; EMOJI.style.transform = ''; EMOJI.style.color = ''; EMOJI.classList.remove('spin'); }

  document.addEventListener('touchstart', e => {
    if (loading) return;
    const lock = document.getElementById('lockOverlay');
    if (lock && !lock.classList.contains('hidden')) return;
    const ob = document.getElementById('onboardingOverlay');
    if (ob && !ob.classList.contains('hidden')) return;
    if ((window.scrollY || document.documentElement.scrollTop) > 0 || e.touches.length !== 1) return;
    startY = e.touches[0].clientY; pulling = true; triggered = false;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!pulling || loading) return;
    if (e.touches.length !== 1) { pulling = false; springBack(); return; }
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { pulling = false; return; }
    e.preventDefault();
    applyMove(dy * RESISTANCE);
    if (dy >= THRESHOLD && !triggered) { triggered = true; LABEL.textContent = '놓으면 새로고침!'; LABEL.style.color = '#F18091'; EMOJI.style.transform = 'scale(1.35)'; EMOJI.style.color = '#F18091'; }
    if (dy < THRESHOLD && triggered)   { triggered = false; LABEL.textContent = '당겨서 새로고침'; LABEL.style.color = ''; EMOJI.style.transform = 'scale(1)'; EMOJI.style.color = ''; }
  }, { passive: false });

  document.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;
    if (!triggered) { springBack(resetIndicator); return; }
    loading = true; LABEL.textContent = '확인 중...'; EMOJI.classList.add('spin'); EMOJI.style.transform = '';
    try { await checkInstaStatus(); } catch(_) {}
    springBack(() => { resetIndicator(); loading = false; showToast('✨ 최신 상태예요!'); });
  });
})();
