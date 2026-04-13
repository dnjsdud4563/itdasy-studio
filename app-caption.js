// Itdasy Studio - 캡션 생성 (슬롯머신, 톤 컨트롤, 해시태그)

// ===== 해시태그 셔플 믹싱 =====
// 이전에 사용한 태그 순서 기록 → 매번 다른 조합·순서로 노출
function shuffleHashtags(tags) {
  if (!tags || tags.length === 0) return tags;

  // 이전 사용 기록 로드
  let history = [];
  try { history = JSON.parse(localStorage.getItem('itdasy_hash_history') || '[]'); } catch(_) {}

  // 핵심 태그(앞 3개)는 고정, 나머지를 셔플 대상으로 분리
  const core = tags.slice(0, 3);
  const pool = tags.slice(3);

  // 이전 마지막 조합과 겹치는 인덱스 파악
  const lastCombo = history[history.length - 1] || [];
  // 피셔-예이츠 셔플 후, 직전 순서와 최소 2개 이상 다르면 채택
  let shuffled;
  let attempts = 0;
  do {
    shuffled = [...pool].sort(() => Math.random() - 0.5);
    attempts++;
  } while (
    attempts < 8 &&
    pool.length >= 4 &&
    shuffled.slice(0, 4).every((t, i) => lastCombo[i] === t)
  );

  const result = [...core, ...shuffled];

  // 히스토리 최대 5개 유지
  history.push(result.map(h => h.replace(/^#/, '')));
  if (history.length > 5) history.shift();
  localStorage.setItem('itdasy_hash_history', JSON.stringify(history));

  return result;
}

// ===== 캡션 로딩 팝업 (슬롯머신) =====
const SLOT_KEYWORDS = [
  ['따뜻한','친근한','유머러스','전문적인','감성적인','활발한','차분한','트렌디한','포근한','자연스러운'],
  ['짧게','보통','길게','핵심만','상세하게','간결하게','풍부하게','딱맞게','깔끔하게','진심으로'],
  ['✨','🎀','💕','🌸','😊','💫','🔥','🌿','💗','🙏'],
];
let _slotTimers = [];
let _slotLocked = [false, false, false];
let _personaFinalWords = ['자연스러운', '보통', '✨'];

function _initSlotStrip(idx) {
  const strip = document.getElementById('slotStrip' + idx);
  if (!strip) return;
  strip.innerHTML = '';
  const words = [...SLOT_KEYWORDS[idx], ...SLOT_KEYWORDS[idx], ...SLOT_KEYWORDS[idx]];
  words.forEach(w => {
    const div = document.createElement('div');
    div.className = 'slot-item';
    div.textContent = w;
    strip.appendChild(div);
  });
  strip.style.transition = 'none';
  strip.style.transform = 'translateY(0px)';
}

function _spinReel(idx) {
  const strip = document.getElementById('slotStrip' + idx);
  if (!strip) return;
  let offset = 0;
  const itemH = 44;
  const total = SLOT_KEYWORDS[idx].length * 3;
  const speed = 100 + idx * 35;
  const timer = setInterval(() => {
    if (_slotLocked[idx]) { clearInterval(timer); return; }
    offset -= itemH;
    if (offset < -(total - SLOT_KEYWORDS[idx].length) * itemH) {
      offset = -Math.floor(Math.random() * SLOT_KEYWORDS[idx].length) * itemH;
      strip.style.transition = 'none';
      strip.style.transform = `translateY(${offset}px)`;
      return;
    }
    strip.style.transition = `transform ${speed * 0.9}ms linear`;
    strip.style.transform = `translateY(${offset}px)`;
  }, speed);
  _slotTimers.push(timer);
}

function _lockReel(idx, keyword) {
  _slotLocked[idx] = true;
  const lockEl = document.getElementById('slotLock' + idx);
  if (lockEl) {
    lockEl.textContent = keyword;
    lockEl.classList.add('active');
  }
  // 슬롯 윈도우 숨겨서 글자 겹침 방지
  const stripEl = document.getElementById('slotStrip' + idx);
  if (stripEl) {
    const winEl = stripEl.closest('.slot-window');
    if (winEl) winEl.style.visibility = 'hidden';
  }
}

function showCaptionLoader() {
  const popup = document.getElementById('captionLoadingPopup');
  popup.style.display = 'flex';
  _slotLocked = [false, false, false];
  _slotTimers.forEach(t => { clearInterval(t); clearTimeout(t); });
  _slotTimers = [];

  // 페르소나 데이터로 최종 잠금 키워드 설정
  const raw = JSON.parse(localStorage.getItem('itdasy_latest_analysis') || '{}');
  const avgLen = parseInt(raw.avg_caption_length) || 0;
  const lenWord = avgLen > 0 ? (avgLen < 50 ? '짧게' : avgLen > 120 ? '길게' : '보통') : '보통';
  const emojiMatch = (raw.emojis || '').match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
  const emojiWord = emojiMatch ? emojiMatch[0] : '✨';
  const toneWord = (raw.tone_summary || raw.tone || '').replace(/["']/g, '').trim().split(/[\s,·]+/)[0] || '자연스러운';
  _personaFinalWords = [toneWord, lenWord, emojiWord];

  [0,1,2].forEach(i => {
    const lock = document.getElementById('slotLock' + i);
    if (lock) lock.classList.remove('active');
    // 슬롯 윈도우 다시 표시
    const stripEl = document.getElementById('slotStrip' + i);
    if (stripEl) {
      const winEl = stripEl.closest('.slot-window');
      if (winEl) winEl.style.visibility = '';
    }
    _initSlotStrip(i);
    setTimeout(() => _spinReel(i), i * 120);
  });
  document.getElementById('clMsg').textContent = '원장님 말투로 조합 중...';
  document.getElementById('clHint').textContent = '키워드 조합 중이에요 ✨';

  // 메시지 순환
  const _clMsgs = ['원장님 말투 불러오는 중...', 'AI가 글 구상 중이에요...', '해시태그 고르는 중...', '거의 다 됐어요...'];
  let _clMsgIdx = 0;
  const _clMsgTimer = setInterval(() => {
    _clMsgIdx = Math.min(_clMsgIdx + 1, _clMsgs.length - 1);
    if (!_slotLocked[0]) document.getElementById('clMsg').textContent = _clMsgs[_clMsgIdx];
  }, 1600);
  _slotTimers.push(_clMsgTimer);

}

function hideCaptionLoader(success, onClose) {
  // 아직 안 잠긴 릴만 순차 잠금 (150ms 간격) — API 응답 완료 시점에 맞춰 빠르게 종료
  const finalWords = [
    _personaFinalWords[0] || SLOT_KEYWORDS[0][Math.floor(Math.random() * SLOT_KEYWORDS[0].length)],
    _personaFinalWords[1] || SLOT_KEYWORDS[1][Math.floor(Math.random() * SLOT_KEYWORDS[1].length)],
    _personaFinalWords[2] || SLOT_KEYWORDS[2][Math.floor(Math.random() * SLOT_KEYWORDS[2].length)],
  ];
  let lastLockDelay = 0;
  [0, 1, 2].forEach(i => {
    if (!_slotLocked[i]) {
      setTimeout(() => _lockReel(i, finalWords[i]), i * 150);
      lastLockDelay = i * 150;
    }
  });
  // 마지막 릴 잠금 후 350ms 뒤 닫기
  setTimeout(() => {
    _slotTimers.forEach(t => { clearInterval(t); clearTimeout(t); });
    _slotTimers = [];
    document.getElementById('captionLoadingPopup').style.display = 'none';
    _slotLocked = [false, false, false];
    if (onClose) setTimeout(onClose, 80);
  }, lastLockDelay + 350);
}

// ===== 온보딩 캡션 테스트 팝업 =====
async function showOnboardingCaptionPopup() {
  const popup = document.getElementById('onboardingCaptionPopup');
  const ta = document.getElementById('ocpTextarea');

  // 팝업을 먼저 열고, 생성 중 상태로 표시
  const loadingMsgs = ['AI가 말투를 분석하고 있어요...✨', '게시물 스타일 학습 중...🎀', '피드 글 초안 작성 중...📝', '거의 다 됐어요!💫'];
  let msgIdx = 0;
  ta.value = loadingMsgs[0];
  ta.readOnly = true;
  ta.style.opacity = '0.5';
  popup.style.display = 'flex';
  const loadingTimer = setInterval(() => { msgIdx = (msgIdx + 1) % loadingMsgs.length; ta.value = loadingMsgs[msgIdx]; }, 2000);

  // 저장 버튼도 비활성화
  const saveBtn = popup.querySelector('.ocp-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.5'; }

  try {
    const shopType = localStorage.getItem('shop_type') || '붙임머리';
    const res = await fetch(API + '/caption/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ description: `${shopType} 시술. 오늘 새로운 손님. 결과 대만족.`, platform: 'instagram' }),
    });
    if (res.ok) {
      const d = await res.json();
      ta.value = d.caption.trim();
    } else {
      ta.value = '직접 평소 쓰시는 말투로 한 문단 입력해주시면 학습할게요!';
    }
  } catch(e) {
    ta.value = '직접 평소 쓰시는 말투로 한 문단 입력해주시면 학습할게요!';
  } finally {
    clearInterval(loadingTimer);
    ta.readOnly = false;
    ta.style.opacity = '1';
    if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
  }
}

function closeOnboardingCaptionPopup() {
  document.getElementById('onboardingCaptionPopup').style.display = 'none';
}

async function saveOnboardingCaption() {
  const ta = document.getElementById('ocpTextarea');
  const text = ta.value.trim();
  if (!text || text.length < 10) { showToast('글을 조금 더 입력해주세요!'); return; }

  try {
    const res = await fetch(API + '/shop/persona/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ corrected_caption: text }),
    });
    if (!res.ok) throw new Error();
    closeOnboardingCaptionPopup();
    showToast('학습 완료! 앞으로 모든 글에 반영됩니다! 🎉');
  } catch(e) {
    showToast('저장에 실패했어요. 다시 시도해주세요.');
  }
}

// ===== 90:10 톤 컨트롤러 =====
let _toneCtrl = { length: 'normal', vibe: 'natural' };

const LENGTH_VALS = ['short', 'normal', 'long'];
const LENGTH_LABELS = { short: '짧게', normal: '보통', long: '길게' };

// 0~100 연속 슬라이더 → 구간 매핑 (0~33:short, 34~66:normal, 67~100:long)
function _sliderToMode(v) {
  const n = parseInt(v, 10);
  if (n <= 33) return 'short';
  if (n >= 67) return 'long';
  return 'normal';
}
function _modeToSlider(mode) {
  return mode === 'short' ? 16 : mode === 'long' ? 84 : 50;
}

function _syncLengthSlider(val) {
  const slider = document.getElementById('lengthSlider');
  const label  = document.getElementById('lengthLabel');
  const fill   = document.getElementById('lengthTrackFill');
  if (!slider) return;
  const sv = _modeToSlider(val);
  slider.value = sv;
  if (label) label.textContent = LENGTH_LABELS[val] || '보통';
  if (fill) fill.style.width = `calc(${sv}% - 4px)`;
}

let _lengthSaveTimer = null;
function onLengthSlider(rawVal) {
  const mode = _sliderToMode(rawVal);
  const label = document.getElementById('lengthLabel');
  const fill  = document.getElementById('lengthTrackFill');
  if (label) label.textContent = LENGTH_LABELS[mode] || '보통';
  if (fill)  fill.style.width = `calc(${rawVal}% - 4px)`;
  _toneCtrl.length = mode;
  // 서버 저장 — 드래그 끝날 때 한 번만
  clearTimeout(_lengthSaveTimer);
  _lengthSaveTimer = setTimeout(() => {
    fetch(API + '/shop/persona', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ length_mode: mode }),
    }).catch(() => {});
  }, 500);
}

function initToneController() {
  fetch(API + '/shop/persona', { headers: authHeader() })
    .then(r => r.ok ? r.json() : null)
    .then(p => {
      if (!p) return;
      document.getElementById('toneController').style.display = 'block';
      _toneCtrl.length = p.length_mode || 'normal';
      _toneCtrl.vibe   = p.vibe_mode   || 'natural';
      _syncLengthSlider(_toneCtrl.length);
      _syncTcButtons('tcVibe', _toneCtrl.vibe);
    })
    .catch(() => {});
}

function _syncTcButtons(groupId, activeVal) {
  document.querySelectorAll(`#${groupId} .tc-btn`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.v === activeVal);
  });
}

function setToneCtrl(type, val, el) {
  if (type === 'length') {
    _syncLengthSlider(val);
    _toneCtrl.length = val;
    fetch(API + '/shop/persona', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ length_mode: val }),
    }).catch(() => {});
  } else {
    _syncTcButtons('tcVibe', val);
    _toneCtrl.vibe = val;
    fetch(API + '/shop/persona', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ vibe_mode: val }),
    }).catch(() => {});
  }
}

// ===== 캡션 탭 Before/After 사진 + 포트폴리오 피커 =====
let _captionPortfolioOpen = false;
let _captionSelectedPortfolio = null;
let _captionPhotos = { before: null, after: null }; // { file, objectUrl, tags }

function toggleCaptionPhotoSection() {
  const sec = document.getElementById('captionPhotoSection');
  const btn = document.getElementById('captionPhotoToggleBtn');
  const open = sec.style.display === 'none' || !sec.style.display;
  sec.style.display = open ? 'block' : 'none';
  btn.textContent = open ? '접기 ▲' : '사진 선택 ▼';
}

function handleCaptionPhoto(input, zone) {
  const file = input.files[0];
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  if (_captionPhotos[zone]?.objectUrl) URL.revokeObjectURL(_captionPhotos[zone].objectUrl);
  _captionPhotos[zone] = { file, objectUrl };

  const zoneEl = document.getElementById('caption' + (zone === 'before' ? 'Before' : 'After') + 'Zone');
  const preview = document.getElementById('caption' + (zone === 'before' ? 'Before' : 'After') + 'Preview');
  const imgEl = document.getElementById('caption' + (zone === 'before' ? 'Before' : 'After') + 'Img');
  const emptyEl = document.getElementById('caption' + (zone === 'before' ? 'Before' : 'After') + 'Empty');
  const clearBtn = document.getElementById('caption' + (zone === 'before' ? 'Before' : 'After') + 'Clear');

  imgEl.src = objectUrl;
  preview.style.display = 'block';
  emptyEl.style.display = 'none';
  clearBtn.style.display = 'block';
  zoneEl.classList.add('has-img');
  input.value = '';
  _updateCaptionPhotoInfo();
}

function clearCaptionPhoto(zone, e) {
  e && e.stopPropagation();
  if (_captionPhotos[zone]?.objectUrl) URL.revokeObjectURL(_captionPhotos[zone].objectUrl);
  _captionPhotos[zone] = null;
  const isB = zone === 'before';
  document.getElementById('caption' + (isB ? 'Before' : 'After') + 'Preview').style.display = 'none';
  document.getElementById('caption' + (isB ? 'Before' : 'After') + 'Empty').style.display = 'block';
  document.getElementById('caption' + (isB ? 'Before' : 'After') + 'Clear').style.display = 'none';
  document.getElementById('caption' + (isB ? 'Before' : 'After') + 'Zone').classList.remove('has-img');
  _updateCaptionPhotoInfo();
}

function _updateCaptionPhotoInfo() {
  const infoEl = document.getElementById('captionPhotoInfo');
  const parts = [];
  if (_captionPhotos.before) parts.push('BEFORE 사진 1장');
  if (_captionPhotos.after) parts.push('AFTER 사진 1장');
  if (parts.length) { infoEl.textContent = '📎 ' + parts.join(' + ') + ' 첨부됨'; infoEl.style.display = 'block'; }
  else { infoEl.style.display = 'none'; }
}

async function toggleCaptionPortfolioPicker() {
  _captionPortfolioOpen = !_captionPortfolioOpen;
  const wrap = document.getElementById('captionPortfolioPickerWrap');
  const btn = document.getElementById('captionPortfolioToggleBtn');
  wrap.style.display = _captionPortfolioOpen ? 'block' : 'none';
  btn.textContent = _captionPortfolioOpen ? '📂 포트폴리오 닫기' : '📂 포트폴리오에서 가져오기';
  if (!_captionPortfolioOpen) return;
  const grid = document.getElementById('captionPortfolioGrid');
  grid.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:8px 0;grid-column:1/-1;">불러오는 중...</div>';
  try {
    const res = await fetch(API + '/portfolio', { headers: { ...authHeader(), 'ngrok-skip-browser-warning': 'true' } });
    const items = await res.json();
    grid.innerHTML = '';
    if (!items.length) {
      grid.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:8px 0;grid-column:1/-1;">포트폴리오가 비어있어요</div>';
      return;
    }
    items.forEach(item => {
      const src = item.image_url.startsWith('http') ? item.image_url : API + item.image_url;
      const pt = item.photo_type || 'general';
      const ptColor = { before: '#6495ed', after: 'var(--accent)', general: 'var(--text3)' };
      const ptLabel = { before: 'B', after: 'A', general: '' };
      const cell = document.createElement('div');
      cell.style.cssText = 'position:relative; aspect-ratio:1/1; overflow:hidden; border-radius:10px; cursor:pointer; transition:all 0.15s;';
      cell.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:cover; pointer-events:none;">
        ${ptLabel[pt] ? `<div style="position:absolute;top:3px;right:3px;background:${ptColor[pt]};border-radius:20px;padding:1px 5px;font-size:8px;color:#fff;font-weight:800;">${ptLabel[pt]}</div>` : ''}
        ${item.main_tag ? `<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(0deg,rgba(0,0,0,0.65),transparent);padding:3px 4px;font-size:7px;color:#fff;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.main_tag}</div>` : ''}`;
      cell.onclick = () => {
        document.querySelectorAll('#captionPortfolioGrid > div').forEach(c => c.style.outline = '');
        cell.style.outline = '2.5px solid var(--accent)';
        _captionSelectedPortfolio = item;
        // 사진 종류에 맞는 존에 이미지 채우기
        const targetZone = (pt === 'before') ? 'before' : 'after';
        const imgEl = document.getElementById('caption' + (targetZone === 'before' ? 'Before' : 'After') + 'Img');
        const preview = document.getElementById('caption' + (targetZone === 'before' ? 'Before' : 'After') + 'Preview');
        const emptyEl = document.getElementById('caption' + (targetZone === 'before' ? 'Before' : 'After') + 'Empty');
        const clearBtn = document.getElementById('caption' + (targetZone === 'before' ? 'Before' : 'After') + 'Clear');
        const zoneEl = document.getElementById('caption' + (targetZone === 'before' ? 'Before' : 'After') + 'Zone');
        imgEl.src = src;
        preview.style.display = 'block';
        emptyEl.style.display = 'none';
        clearBtn.style.display = 'block';
        zoneEl.classList.add('has-img');
        _captionPhotos[targetZone] = { file: null, objectUrl: src, tags: [item.main_tag, item.tags].filter(Boolean).join(' ') };
        // 메모에 태그 자동 채우기
        const memoEl = document.getElementById('captionMemo');
        const label = [item.main_tag, item.tags].filter(Boolean).join(', ');
        if (memoEl && !memoEl.value && label) memoEl.value = label;
        _updateCaptionPhotoInfo();
      };
      grid.appendChild(cell);
    });
  } catch(e) {
    grid.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:8px 0;grid-column:1/-1;">불러오기 실패</div>';
  }
}

// ===== 캡션 생성 =====
async function generateCaption() {
  const types = getSel('typeTags');

  const memo = document.getElementById('captionMemo').value;
  const btn = document.getElementById('captionBtn');
  btn.disabled = true;

  document.getElementById('captionResult').style.display = 'none';
  showCaptionLoader();

  const shopType = localStorage.getItem('shop_type') || '붙임머리';
  const cfg = SHOP_CONFIG[shopType] || SHOP_CONFIG['붙임머리'];
  const typeStr = types.length > 0 ? types.join(', ') : cfg.defaultTag;
  // 작업실 슬롯 연결 정보 포함
  const slotNote = (typeof _captionSlotId !== 'undefined' && _captionSlotId && typeof _slots !== 'undefined')
    ? (() => { const s = _slots.find(sl => sl.id === _captionSlotId); return s ? `손님: ${s.label}. 사진 ${s.photos.filter(p=>!p.hidden).length}장. ` : ''; })()
    : '';
  const description = `${shopType} 시술. ${cfg.tagLabel}: ${typeStr}. 업종: ${shopType}. ${slotNote}${memo || ''}`;

  try {
    const res = await fetch(API + '/caption/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        description,
        platform: 'instagram',
        length_mode: _toneCtrl.length || 'normal',
        vibe_mode: _toneCtrl.vibe || 'natural',
      })
    });
    if (res.status === 401) { setToken(null); document.getElementById('lockOverlay').classList.remove('hidden'); throw new Error('로그인이 필요합니다.'); }
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || '생성 실패');

    const finalCaption = data.caption;
    const hashes = Array.isArray(data.hashtags) ? shuffleHashtags(data.hashtags).map(h => h.startsWith('#') ? h : '#' + h).join(' ') : data.hashtags;

    // 슬롯머신의 마지막 릴 잠금 후 1초 뒤에 결과가 표시되도록 hideCaptionLoader에 데이터도 같이 전달
    hideCaptionLoader(true, () => {
      document.getElementById('captionText').value = finalCaption;
      document.getElementById('captionHash').value = hashes;
      document.getElementById('captionResult').style.display = 'block';
      const actionBar = document.getElementById('captionActionBar');
      if (actionBar) actionBar.style.display = 'flex';
      btn.innerHTML = '다시 만들기 ✨';
      btn.disabled = false;

      // 인라인 미리보기: 선택된 슬롯 사진 + 생성된 캡션
      const inlinePrev = document.getElementById('captionInlinePreview');
      if (inlinePrev && typeof _captionSlotId !== 'undefined' && _captionSlotId && typeof _slots !== 'undefined') {
        const slot = _slots.find(s => s.id === _captionSlotId);
        const photos = slot ? slot.photos.filter(p => !p.hidden) : [];
        if (photos.length) {
          const shopName = localStorage.getItem('shop_name') || '잇데이';
          const previewId = 'inl_carousel';
          inlinePrev.style.display = 'block';
          inlinePrev.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #f0f0f0;">
              <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800;">${shopName[0]}</div>
              <div style="font-size:13px;font-weight:700;">${shopName}</div>
            </div>
            <div style="padding:10px 0 6px;">${typeof _buildPeekCarousel === 'function' ? _buildPeekCarousel(photos, previewId) : ''}</div>
            <div style="padding:6px 12px 14px;font-size:12px;color:#333;line-height:1.6;max-height:80px;overflow:hidden;text-overflow:ellipsis;">${finalCaption.slice(0,120)}${finalCaption.length>120?'…':''}</div>
          `;
          if (typeof _initPeekCarousel === 'function') setTimeout(() => _initPeekCarousel(previewId, photos.length), 80);
        }
      }
    });
    return; // 아래 btn 복원은 onClose 콜백에서 처리
  } catch(e) {
    document.getElementById('captionText').value = '오류가 났어요: ' + e.message;
    document.getElementById('captionHash').value = '';
    hideCaptionLoader(false, () => { document.getElementById('captionResult').style.display = 'block'; });
    btn.innerHTML = '다시 만들기 ✨';
    btn.disabled = false;
  }
}

// ===== 마스터: 인스타 자동 발행 (1단계: 프리뷰 열기) =====
function publishToInstagram() {
  if (!getToken()) {
    alert("홈 탭에서 인스타 연동을 먼저 진행해주세요!");
    return;
  }

  const canvas = document.getElementById('baCanvas');
  // 편집 가능한 textarea 값 우선, 없으면 생성된 캡션 사용
  const editedCaption = document.getElementById('publishCaptionPreview').value.trim();
  const caption = document.getElementById('captionText').value;
  const hash = document.getElementById('captionHash').value;
  const hasCaption = caption && !caption.includes("생성된 글이 여기에 나타납니다");

  const finalText = editedCaption || (hasCaption ? caption + "\n\n" + hash : '(글 없이 사진만 올라갑니다)');

  // 팝업 채우기
  const shopName = localStorage.getItem('shop_name') || '사장님';
  document.getElementById('previewShopName').textContent = shopName;
  document.getElementById('previewFinalCaption').textContent = finalText;
  document.getElementById('previewFinalImg').src = canvas.toDataURL('image/png');
  document.getElementById('previewAvatar').innerHTML = document.getElementById('headerAvatar').innerHTML;

  // 팝업 열기
  const pop = document.getElementById('publishPreviewPopup');
  pop.style.display = 'flex';
  setTimeout(() => {
    pop.querySelector('.popup-content').style.transform = 'scale(1)';
    pop.querySelector('.popup-content').style.opacity = '1';
  }, 10);
}

function closePublishPreview() {
  const pop = document.getElementById('publishPreviewPopup');
  pop.querySelector('.popup-content').style.transform = 'scale(0.9)';
  pop.querySelector('.popup-content').style.opacity = '0';
  setTimeout(() => pop.style.display = 'none', 300);
}

// ===== 업로드 진행/완료 팝업 =====
function setUploadProgress(pct, msg) {
  document.getElementById('upPct').textContent = pct + '%';
  document.getElementById('upMsg').textContent = msg;
  document.getElementById('upFill').style.width = pct + '%';
}

function openInstagramProfile() {
  const handle = (_instaHandle || '').replace('@', '');
  window.location.href = handle ? `instagram://user?username=${handle}` : 'instagram://';
}

function closeUploadDone() {
  document.getElementById('uploadDonePopup').style.display = 'none';
}

// ===== 마스터: 인스타 자동 발행 (2단계: 실제 API 호출) =====
async function doActualPublish() {
  const btn = document.getElementById('doPublishBtn');
  const finalCaption = document.getElementById('previewFinalCaption').textContent;
  const withStory = document.getElementById('autoStoryToggle').checked;
  btn.disabled = true;

  const upPopup = document.getElementById('uploadProgressPopup');
  upPopup.style.display = 'flex';
  setUploadProgress(10, '이미지 준비 중...');

  try {
    const canvas = document.getElementById('baCanvas');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const formData = new FormData();
    formData.append('image', blob, 'instagram_post.png');
    formData.append('caption', finalCaption);

    setUploadProgress(30, '서버에 전송 중...');

    const res = await fetch(API + '/instagram/publish', {
      method: 'POST',
      headers: { ...authHeader(), 'ngrok-skip-browser-warning': 'true' },
      body: formData
    });

    setUploadProgress(60, '인스타에 업로드 중...');

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || '업로드 실패');

    // 스토리 자동 발행
    if (withStory) {
      setUploadProgress(75, '스토리 이미지 만드는 중...');
      try {
        const storyBlob = await makeStoryCanvas(canvas);
        const storyForm = new FormData();
        storyForm.append('image', storyBlob, 'story.png');

        setUploadProgress(85, '스토리 업로드 중...');
        const sRes = await fetch(API + '/instagram/publish-story-file', {
          method: 'POST',
          headers: { ...authHeader(), 'ngrok-skip-browser-warning': 'true' },
          body: storyForm
        });
        if (!sRes.ok) {
          const sErr = await sRes.json().catch(() => ({}));
          console.warn('스토리 발행 실패 (피드는 성공):', sErr.detail || '');
          showToast('피드는 올라갔어요! 스토리는 실패: ' + (sErr.detail || ''));
        }
      } catch(sE) {
        console.warn('스토리 오류:', sE.message);
        showToast('피드는 성공! 스토리 실패: ' + sE.message);
      }
    }

    setUploadProgress(95, '마무리 중...');
    await new Promise(r => setTimeout(r, 400));
    setUploadProgress(100, withStory ? '피드+스토리 완료! 🎉' : '완료! 🎉');

    setTimeout(() => {
      upPopup.style.display = 'none';
      closePublishPreview();
      document.getElementById('uploadDonePopup').style.display = 'flex';
      document.getElementById('uploadDoneMsg').textContent =
        withStory ? '피드 + 스토리에 올라갔어요 ✨' : '인스타 피드에 올라갔어요 ✨';
      for(let i = 0; i < 20; i++) setTimeout(createConfetti, i * 100);
    }, 1200);

  } catch(e) {
    upPopup.style.display = 'none';
    showToast('오류: ' + e.message);
    btn.textContent = '다시 시도하기 🚀';
    btn.disabled = false;
  }
}

// 1:1 피드 캔버스 → 9:16 스토리 캔버스 변환
async function makeStoryCanvas(feedCanvas) {
  const SW = 1080, SH = 1920;
  const sc = document.createElement('canvas');
  sc.width = SW; sc.height = SH;
  const ctx = sc.getContext('2d');

  // 배경: 다크 그라데이션
  const grad = ctx.createLinearGradient(0, 0, 0, SH);
  grad.addColorStop(0, '#0f0608');
  grad.addColorStop(1, '#1a0810');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SW, SH);

  // 피드 이미지 중앙 배치 (1080x1080 → 세로 중앙)
  const imgSize = SW; // 1080
  const imgY = (SH - imgSize) / 2; // 420
  ctx.drawImage(feedCanvas, 0, imgY, imgSize, imgSize);

  // 상단 브랜딩 텍스트
  ctx.fillStyle = 'rgba(241,128,145,0.9)';
  ctx.font = 'bold 36px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('잇데이 STUDIO', SW / 2, imgY - 40);

  return new Promise(resolve => sc.toBlob(resolve, 'image/png'));
}

function copyCaption() {
  navigator.clipboard.writeText(document.getElementById('captionText').value)
    .then(() => showToast('글 복사 완료! 📋'));
}
function copyAll() {
  const c = document.getElementById('captionText').value;
  const h = document.getElementById('captionHash').value;
  navigator.clipboard.writeText(c + '\n\n' + h).then(() => showToast('전체 복사 완료! 📋'));
}
function flashBtn(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => btn.textContent = orig, 1500);
}

// ===== Before/After =====
const imgs = { before: null, after: null };

function loadImage(input, side) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      imgs[side] = img;
      const preview = document.getElementById(side + 'Preview');
      const area = document.getElementById(side + 'Area');
      preview.src = e.target.result;
      preview.style.display = 'block';
      area.style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderBA() {
  if (!imgs.before || !imgs.after) {
    alert('Before, After 사진을 모두 선택해주세요!');
    return;
  }
  const layout = document.querySelector('.style-opts .style-opt.on[data-v]') ?
    document.querySelectorAll('.style-opts .style-opt.on')[0].dataset.v : 'side';
  const wm = document.querySelectorAll('.style-opts .style-opt.on')[1]?.dataset.v || 'wm1';

  const canvas = document.getElementById('baCanvas');
  const ctx = canvas.getContext('2d');

  let W, H;
  if (layout === 'side' || layout === 'square') {
    W = 1080; H = 1080;
  } else {
    W = 1080; H = 1350;
  }
  canvas.width = W; canvas.height = H;
  canvas.style.display = 'block';

  ctx.fillStyle = '#0f0608';
  ctx.fillRect(0, 0, W, H);

  function drawCropped(img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale, sh = h / scale;
    const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  const PAD = 6;
  if (layout === 'side' || layout === 'square') {
    const hw = (W - PAD * 3) / 2;
    const ih = H - PAD * 2 - 80;
    drawCropped(imgs.before, PAD, PAD, hw, ih);
    drawCropped(imgs.after, PAD * 2 + hw, PAD, hw, ih);
    // 라벨
    const ly = ih + PAD + 10;
    drawLabel(ctx, 'BEFORE', PAD + hw / 2, ly, W);
    drawLabel(ctx, 'AFTER ✨', PAD * 2 + hw + hw / 2, ly, W);
  } else {
    const hh = (H - PAD * 3 - 80) / 2;
    drawCropped(imgs.before, PAD, PAD, W - PAD * 2, hh);
    drawCropped(imgs.after, PAD, PAD * 2 + hh, W - PAD * 2, hh);
    drawLabel(ctx, 'BEFORE', W / 2, hh + PAD + 14, W);
    drawLabel(ctx, 'AFTER ✨', W / 2, hh * 2 + PAD * 2 + 14, W);
  }

  // 워터마크
  if (wm !== 'wm0') {
    const wmText = wm === 'wm1' ? '🎀 @itdasy' : '잇데이 붙임머리';
    ctx.fillStyle = 'rgba(232,160,176,0.9)';
    ctx.font = '500 28px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(wmText, W / 2, H - 22);
  }

  // 인스타 발행 미리보기 세팅 (캡션 + 해시태그 합체)
  const c = document.getElementById('captionText').value;
  const h = document.getElementById('captionHash').value;
  const previewArea = document.getElementById('publishConfirmArea');
  const previewInput = document.getElementById('publishCaptionPreview');

  if (c && !c.includes("생성된 글이 여기에 나타납니다")) {
      previewInput.value = c + "\n\n" + h;
      previewArea.style.display = 'block';
  } else {
      previewArea.style.display = 'block';
      previewInput.value = '⚠️ 아직 글을 만들지 않으셨어요.\n\n사진만 올라갑니다. 첫 번째 탭에서 글을 먼저 만드시는 걸 추천드려요!';
  }

  document.getElementById('publishArea').style.display = 'block';
}

function resetBA() {
  imgs.before = null; imgs.after = null;
  document.getElementById('beforePreview').style.display = 'none';
  document.getElementById('afterPreview').style.display = 'none';
  document.getElementById('beforeArea').style.display = 'block';
  document.getElementById('afterArea').style.display = 'block';
  document.getElementById('baCanvas').style.display = 'none';
  document.getElementById('saveBtn').style.display = 'none';
  document.getElementById('resetBaBtn').style.display = 'none';
  document.getElementById('publishConfirmArea').style.display = 'none';
  document.getElementById('publishArea').style.display = 'none';
  document.querySelectorAll('#tab-ba input[type=file]').forEach(i => i.value = '');
}

function drawLabel(ctx, text, x, y, W) {
  ctx.fillStyle = 'rgba(15,6,8,0.7)';
  ctx.roundRect(x - 70, y - 22, 140, 34, 17);
  ctx.fill();
  ctx.fillStyle = '#f0e8ea';
  ctx.font = '500 18px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function saveCanvas() {
  const canvas = document.getElementById('baCanvas');
  const a = document.createElement('a');
  a.download = 'itdasy_ba_' + Date.now() + '.jpg';
  a.href = canvas.toDataURL('image/jpeg', 0.92);
  a.click();
}

function createConfetti() {
  const c = document.createElement('div');
  c.textContent = ['🎀','✨','💎','🩷'][Math.floor(Math.random()*4)];
  c.className = 'confetti';
  c.style.left = Math.random() * 100 + 'vw';
  c.style.animationDuration = Math.random() * 2 + 3 + 's';
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 5000);
}
