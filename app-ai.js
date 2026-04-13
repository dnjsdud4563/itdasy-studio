// Itdasy Studio - AI 추천 & 예약 송출

// =====================================================================
// ===== AI 추천 탭 (3-B) =====
// =====================================================================
let _aiSuggestData = null;
let _lastAiPickedId = null;

// AI 추천 단계 체크리스트 애니메이션
let _aiStepTimers = [];

function _resetAiSteps() {
  _aiStepTimers.forEach(t => clearTimeout(t)); _aiStepTimers = [];
  [0,1,2,3].forEach(i => {
    const row = document.getElementById('aiStep' + i);
    if (row) { row.classList.remove('active','done'); const ind = row.querySelector('.ai-step-indicator'); if (ind) ind.textContent = ''; }
  });
}

function _activateAiStep(idx) {
  const row = document.getElementById('aiStep' + idx);
  if (!row) return;
  // 이전 단계 완료 처리
  if (idx > 0) {
    const prev = document.getElementById('aiStep' + (idx - 1));
    if (prev) {
      prev.classList.remove('active');
      prev.classList.add('done');
      const ind = prev.querySelector('.ai-step-indicator');
      if (ind) ind.textContent = '✓';
    }
  }
  row.classList.add('active');
}

function _completeAllAiSteps() {
  [0,1,2,3].forEach(i => {
    const row = document.getElementById('aiStep' + i);
    if (row) {
      row.classList.remove('active');
      row.classList.add('done');
      const ind = row.querySelector('.ai-step-indicator');
      if (ind) ind.textContent = '✓';
    }
  });
}

function _startAiStepAnimation() {
  _resetAiSteps();
  _activateAiStep(0);
  // 단계 1→2→3은 시간 기반으로 순차 활성화 (API 응답까지 자연스럽게 진행)
  _aiStepTimers.push(setTimeout(() => _activateAiStep(1), 900));
  _aiStepTimers.push(setTimeout(() => _activateAiStep(2), 2000));
  _aiStepTimers.push(setTimeout(() => _activateAiStep(3), 3200));
}

async function loadAiSuggest(itemId) {
  if (!getToken()) return;
  _lastAiPickedId = itemId || null;
  const loading = document.getElementById('aiSuggestLoading');
  const card    = document.getElementById('aiSuggestCard');
  const errDiv  = document.getElementById('aiSuggestError');
  const emptyEl = document.getElementById('aiSuggestPickerEmpty');
  if (!loading) return;
  loading.style.display = 'block';
  card.style.display    = 'none';
  if (errDiv) errDiv.style.display = 'none';
  if (emptyEl) emptyEl.style.display = 'none';

  _startAiStepAnimation();

  try {
    const url = API + '/portfolio/ai-suggest' + (itemId ? `?item_id=${itemId}` : '');
    const res = await fetch(url, { headers: { ...authHeader(), 'ngrok-skip-browser-warning': 'true' } });
    _aiStepTimers.forEach(t => clearTimeout(t)); _aiStepTimers = [];
    _completeAllAiSteps();
    await new Promise(r => setTimeout(r, 400)); // 완료 시각 효과 잠깐 보여줌
    loading.style.display = 'none';

    if (res.status === 404) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      document.getElementById('aiSuggestErrorMsg').textContent = errData.detail || '잠시 후 다시 시도해주세요';
      if (errDiv) errDiv.style.display = 'block';
      return;
    }

    const data = await res.json();
    _aiSuggestData = data;

    const img = document.getElementById('aiSuggestImg');
    const imgSrc = data.image_url
      ? (data.image_url.startsWith('http') ? data.image_url : API + data.image_url)
      : '';
    img.src = imgSrc;
    img.style.display = imgSrc ? 'block' : 'none';

    // 태그 뱃지
    const badge = document.getElementById('aiSuggestTagBadge');
    badge.innerHTML = '';
    const allTags = [data.main_tag, data.tags].filter(Boolean).join(',').split(',').map(t=>t.trim()).filter(Boolean);
    allTags.slice(0,3).forEach(t => {
      const span = document.createElement('span');
      span.style.cssText = 'background:rgba(255,255,255,0.35); backdrop-filter:blur(4px); border-radius:20px; padding:2px 8px; font-size:9px; color:#fff; font-weight:700;';
      span.textContent = t;
      badge.appendChild(span);
    });

    document.getElementById('aiSuggestCaption').textContent = data.caption || '';
    const hashArr = Array.isArray(data.hashtags) ? data.hashtags : [];
    document.getElementById('aiSuggestHash').textContent = hashArr.map(h => h.startsWith('#') ? h : '#'+h).join(' ');

    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch(e) {
    _aiStepTimers.forEach(t => clearTimeout(t)); _aiStepTimers = [];
    loading.style.display = 'none';
    if (errDiv) {
      document.getElementById('aiSuggestErrorMsg').textContent = e.message || '네트워크 오류';
      errDiv.style.display = 'block';
    }
  }
}

function aiSuggestRetry() {
  loadAiSuggest(_lastAiPickedId);
}

function copyAiSuggest() {
  if (!_aiSuggestData) return;
  const cap = document.getElementById('aiSuggestCaption').textContent.trim();
  const hash = document.getElementById('aiSuggestHash').textContent.trim();
  navigator.clipboard.writeText(cap + (hash ? '\n\n' + hash : '')).catch(() => {});
  showToast('글 복사 완료 📋');
}

async function publishAiSuggestDirect() {
  if (!_aiSuggestData) return;
  const imgSrc = _aiSuggestData.image_url
    ? (_aiSuggestData.image_url.startsWith('http') ? _aiSuggestData.image_url : API + _aiSuggestData.image_url)
    : '';
  const cap = document.getElementById('aiSuggestCaption').textContent.trim();
  const hash = document.getElementById('aiSuggestHash').textContent.trim();
  const fullCaption = cap + (hash ? '\n\n' + hash : '');
  if (!imgSrc) { showToast('이미지가 없어요'); return; }
  // 인스타 업로드 플로우 위임
  await doInstagramPublish(imgSrc, fullCaption);
}

async function doInstagramPublish(imageUrl, captionText) {
  const upPopup = document.getElementById('uploadProgressPopup');
  try {
    upPopup.style.display = 'flex';
    setUploadProgress(10, '인스타 연결 중...');
    const res = await fetch(API + '/instagram/publish', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ image_url: imageUrl, caption: captionText }),
    });
    setUploadProgress(90, '업로드 완료 처리 중...');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      upPopup.style.display = 'none';
      showToast('업로드 실패: ' + (err.detail || '인스타 연결을 확인해주세요'));
      return;
    }
    upPopup.style.display = 'none';
    const donePopup = document.getElementById('uploadDonePopup');
    const doneMsg = document.getElementById('uploadDoneMsg');
    if (doneMsg) doneMsg.textContent = 'AI 추천 게시물이 인스타에 올라갔어요! 🎀';
    if (donePopup) donePopup.style.display = 'flex';
  } catch(e) {
    upPopup.style.display = 'none';
    showToast('업로드 오류: ' + e.message);
  }
}

function goToCaption() {
  if (!_aiSuggestData) return;
  const cap = document.getElementById('aiSuggestCaption').textContent.trim();
  const hash = document.getElementById('aiSuggestHash').textContent.trim();
  showTab('caption', document.querySelector('.nav-btn[onclick*="caption"]'));
  setTimeout(() => {
    const captionEl = document.getElementById('captionText');
    const hashEl = document.getElementById('captionHash');
    const resultEl = document.getElementById('captionResult');
    if (captionEl) captionEl.textContent = cap;
    if (hashEl) hashEl.textContent = hash;
    if (resultEl) resultEl.style.display = 'block';
  }, 100);
}

// =====================================================================
// ===== 예약 송출 (3-C) =====
// =====================================================================
function showSchedulePanel() {
  const r = document.getElementById('captionResult');
  if (r && r.style.display !== 'none') {
    document.getElementById('scheduleToggleBtn').style.display = 'block';
  }
}

async function createSchedule() {
  const dt = document.getElementById('scheduleDateTime').value;
  if (!dt) { showToast('날짜와 시간을 선택해주세요!'); return; }
  const caption = document.getElementById('captionText').value || '';
  const hash = document.getElementById('captionHash').value || '';
  const hashtags = hash.replace(/#/g, '').split(/\s+/).filter(Boolean).join(',');

  // 이미지 URL: 현재 편집된 이미지가 있으면 사용, 없으면 빈 값으로 예약만 등록
  const imageUrl = window._lastPublishedImageUrl || '';

  try {
    const res = await fetch(API + '/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption.trim(),
        hashtags: hashtags,
        scheduled_at: new Date(dt).toISOString(),
      }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || '예약 실패');
    document.getElementById('schedulePanel').style.display = 'none';
    document.getElementById('scheduleToggleBtn').style.display = 'none';
    showToast('예약 등록됐어요! ⏰ ' + dt.replace('T', ' '));
  } catch(e) {
    showToast('예약 실패: ' + e.message);
  }
}

// 캡션 생성 완료 후 예약 버튼 노출
const _origGenerateCaptionEnd = window.generateCaption;
