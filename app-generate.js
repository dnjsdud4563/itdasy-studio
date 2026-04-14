// Itdasy Studio - C7.5 캡션 생성 탭
// 파일: app-generate.js
// 의존: app-core.js 의 API, authHeader(), handle401()

// ── 로컬 fetch 헬퍼 ──────────────────────────────────────────────
async function _genFetch(method, path, body) {
  const headers = { ...authHeader() };
  let bodyStr;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(body);
  }
  const res = await fetch(API + path, { method, headers, body: bodyStr });
  if (res.status === 401) { handle401(); throw new Error('401'); }
  return res;
}

// ── 탭 초기화 ─────────────────────────────────────────────────────
function initGenerateTab() {
  const root = document.getElementById('generateRoot');
  if (root._genInited) return;
  root._genInited = true;
  root.innerHTML = _genBuildUI();
  _genBindEvents();
}

// ── UI 빌드 ───────────────────────────────────────────────────────
function _genBuildUI() {
  return `
<div style="padding:16px 16px 100px;">

  <!-- 블록 A: 입력 -->
  <div style="background:#fff; border-radius:18px; border:1px solid var(--border); padding:20px; margin-bottom:16px;">
    <div style="font-size:15px; font-weight:800; color:var(--text); margin-bottom:16px;">캡션 생성</div>

    <!-- 카테고리 라디오 -->
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; font-weight:700; color:var(--text2); margin-bottom:8px;">카테고리 <span style="color:var(--accent);">*</span></div>
      <div style="display:flex; gap:10px;">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px; font-weight:600; color:var(--text);">
          <input type="radio" name="genCategory" value="붙임머리" id="genCat1" style="accent-color:var(--accent);">
          붙임머리
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px; font-weight:600; color:var(--text);">
          <input type="radio" name="genCategory" value="네일" id="genCat2" style="accent-color:var(--accent);">
          네일
        </label>
      </div>
    </div>

    <!-- 사진 설명 -->
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; font-weight:700; color:var(--text2); margin-bottom:8px;">사진 설명 <span style="color:var(--accent);">*</span></div>
      <textarea
        id="genPhotoCtx"
        maxlength="300"
        placeholder="예: 신부 웨딩용 풀 드롭 스타일, 애쉬 브라운"
        style="width:100%; box-sizing:border-box; height:80px; padding:12px; border-radius:12px; border:1.5px solid var(--border); font-family:inherit; font-size:14px; color:var(--text); resize:none; outline:none; line-height:1.5;"
      ></textarea>
      <div style="text-align:right; font-size:11px; color:var(--text3); margin-top:4px;"><span id="genPhotoCtxCount">0</span>/300</div>
    </div>

    <!-- 추가 메모 -->
    <div style="margin-bottom:20px;">
      <div style="font-size:12px; font-weight:700; color:var(--text2); margin-bottom:8px;">추가 메모 <span style="color:var(--text3); font-weight:500;">(선택)</span></div>
      <textarea
        id="genMemo"
        maxlength="200"
        placeholder="예: 4월 한정 10% 할인"
        style="width:100%; box-sizing:border-box; height:60px; padding:12px; border-radius:12px; border:1.5px solid var(--border); font-family:inherit; font-size:14px; color:var(--text); resize:none; outline:none; line-height:1.5;"
      ></textarea>
      <div style="text-align:right; font-size:11px; color:var(--text3); margin-top:4px;"><span id="genMemoCount">0</span>/200</div>
    </div>

    <!-- 인라인 오류 -->
    <div id="genError" style="display:none; font-size:13px; color:#e03e3e; font-weight:600; margin-bottom:12px; padding:10px 12px; background:#fff0f0; border-radius:10px; border:1px solid #ffd0d0;"></div>

    <!-- 생성 버튼 -->
    <button
      id="genSubmitBtn"
      onclick="_genSubmit()"
      disabled
      style="width:100%; padding:16px; border-radius:14px; border:none; background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; font-size:15px; font-weight:800; cursor:pointer; opacity:0.4; transition:opacity 0.2s;"
    >캡션 생성</button>
  </div>

  <!-- 블록 B: 결과 (생성 후 표시) -->
  <div id="genResultBlock" style="display:none; background:#fff; border-radius:18px; border:1px solid var(--border); padding:20px;">
    <div style="font-size:13px; font-weight:700; color:var(--text2); margin-bottom:10px;">생성된 캡션</div>
    <textarea
      id="genResultText"
      style="width:100%; box-sizing:border-box; min-height:160px; padding:14px; border-radius:12px; border:1.5px solid var(--border); font-family:inherit; font-size:14px; color:var(--text); resize:vertical; outline:none; line-height:1.6;"
    ></textarea>
    <!-- 메타 정보 -->
    <div id="genMeta" style="margin-top:8px; font-size:11px; color:var(--text3);"></div>
    <!-- 액션 버튼 -->
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button
        onclick="_genCopy()"
        style="flex:1; padding:14px; border-radius:12px; border:1.5px solid var(--border); background:#fff; font-size:14px; font-weight:700; color:var(--text); cursor:pointer;"
      >복사</button>
      <button
        onclick="_genRegenerate()"
        id="genRegenBtn"
        style="flex:1; padding:14px; border-radius:12px; border:none; background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; font-size:14px; font-weight:700; cursor:pointer;"
      >재생성</button>
    </div>
  </div>

</div>`;
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────────
function _genBindEvents() {
  // 카테고리 변경
  document.querySelectorAll('input[name="genCategory"]').forEach(r => {
    r.addEventListener('change', _genCheckReady);
  });
  // 사진 설명 카운터 + 활성화 체크
  const photoCtx = document.getElementById('genPhotoCtx');
  photoCtx.addEventListener('input', () => {
    document.getElementById('genPhotoCtxCount').textContent = photoCtx.value.length;
    _genCheckReady();
  });
  // 메모 카운터
  const memo = document.getElementById('genMemo');
  memo.addEventListener('input', () => {
    document.getElementById('genMemoCount').textContent = memo.value.length;
  });
}

// ── 버튼 활성화 판단 ──────────────────────────────────────────────
function _genCheckReady() {
  const catSelected = !!document.querySelector('input[name="genCategory"]:checked');
  const photoFilled = document.getElementById('genPhotoCtx').value.trim().length > 0;
  const btn = document.getElementById('genSubmitBtn');
  const ready = catSelected && photoFilled;
  btn.disabled = !ready;
  btn.style.opacity = ready ? '1' : '0.4';
  btn.style.cursor = ready ? 'pointer' : 'default';
}

// ── API 호출 ──────────────────────────────────────────────────────
async function _genSubmit() {
  const btn = document.getElementById('genSubmitBtn');
  const regenBtn = document.getElementById('genRegenBtn');
  const errorEl = document.getElementById('genError');

  // 연타 방지
  btn.disabled = true;
  btn.style.opacity = '0.4';
  btn.textContent = '생성 중...';
  errorEl.style.display = 'none';

  const category = document.querySelector('input[name="genCategory"]:checked').value;
  const photo_context = document.getElementById('genPhotoCtx').value.trim();
  const memo = document.getElementById('genMemo').value.trim();

  const payload = { category, photo_context };
  if (memo) payload.memo = memo;

  try {
    const res = await _genFetch('POST', '/persona/generate/caption', payload);

    if (res.ok) {
      const data = await res.json();
      _genShowResult(data);
    } else if (res.status === 400) {
      const data = await res.json();
      _genShowError(data.detail || data.code || '');
    } else {
      _genShowError('__500__');
    }
  } catch (e) {
    if (e.message !== '401') _genShowError('__500__');
  } finally {
    // 버튼 복원 (결과 표시 여부와 무관하게 재입력 가능하도록)
    btn.textContent = '캡션 생성';
    _genCheckReady();
  }
}

async function _genRegenerate() {
  const regenBtn = document.getElementById('genRegenBtn');
  regenBtn.disabled = true;
  regenBtn.style.opacity = '0.5';
  regenBtn.textContent = '재생성 중...';
  await _genSubmit();
  regenBtn.disabled = false;
  regenBtn.style.opacity = '1';
  regenBtn.textContent = '재생성';
}

// ── 결과 표시 ─────────────────────────────────────────────────────
function _genShowResult(data) {
  document.getElementById('genResultText').value = data.caption || '';

  // 메타 줄
  const parts = [];
  if (data.cache_hit) parts.push('캐시 HIT');
  if (data.examples_used != null) parts.push(`예시 ${data.examples_used}개 참조`);
  if (data.tokens != null) parts.push(`${data.tokens} tokens`);
  document.getElementById('genMeta').textContent = parts.join(' • ');

  document.getElementById('genResultBlock').style.display = 'block';
  document.getElementById('genError').style.display = 'none';

  // 결과 블록으로 부드럽게 스크롤
  document.getElementById('genResultBlock').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── 에러 표시 ─────────────────────────────────────────────────────
function _genShowError(codeOrMsg) {
  const messages = {
    'identity_incomplete': '페르소나 탭 필수 5필드부터 채워주세요',
    'fingerprint_missing': "페르소나 탭 '말투 지문 추출' 먼저 실행해주세요",
    'consent_missing': '페르소나 탭 하단 동의를 먼저 해주세요',
    '__500__': '일시적 오류. 다시 시도해주세요',
  };
  const el = document.getElementById('genError');
  el.textContent = messages[codeOrMsg] || messages['__500__'];
  el.style.display = 'block';
}

// ── 복사 ──────────────────────────────────────────────────────────
function _genCopy() {
  const text = document.getElementById('genResultText').value;
  if (!text) return;
  try {
    navigator.clipboard.writeText(text).then(() => {
      _genToast('클립보드에 복사됐어요');
    });
  } catch (e) {
    // fallback
    const ta = document.getElementById('genResultText');
    ta.select();
    document.execCommand('copy');
    _genToast('클립보드에 복사됐어요');
  }
}

function _genToast(msg) {
  const t = document.getElementById('copyToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}
