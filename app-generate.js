// Itdasy Studio - C7.5 캡션 생성 탭
// 파일: app-generate.js
// 의존: app-core.js 의 API, authHeader(), handle401()
//       app-persona.js 의 _personaFetch, _esc (공유)
// 에러 처리: 인라인 UI 메시지(_genShowError)로 표시 — persona 탭의 msgEl 방식과 의도적으로 구분

// ── 시그니처 블록 로컬 캐시 (세션 내 1회 로드) ───────────────────
// null = 미로드 / [] = 로드 완료(빈 목록 포함)
let _genSigCache = null;

async function _genLoadSigCache() {
  if (_genSigCache !== null) return _genSigCache;
  try {
    const res = await _personaFetch('GET', '/persona/signature');
    if (!res.ok) { _genSigCache = []; return _genSigCache; }
    const raw = await res.json();
    _genSigCache = Array.isArray(raw) ? raw : (raw.signatures || raw.items || []);
  } catch (e) {
    _genSigCache = [];
  }
  return _genSigCache;
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
    <!-- 시그니처 블록 칩 -->
    <div id="genSigChips" style="display:none; margin-top:10px;"></div>
    <!-- taboo 경고 -->
    <div id="genTabooWrap" style="display:none; margin-top:8px;"></div>
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
  const errorEl = document.getElementById('genError');

  // 연타 방지
  btn.disabled = true;
  btn.style.opacity = '0.4';
  btn.textContent = '생성 중...';
  errorEl.style.display = 'none';

  // 이전 결과 보조 UI 초기화 (재생성 시 stale 칩/배지 제거)
  const sigChipsEl = document.getElementById('genSigChips');
  if (sigChipsEl) sigChipsEl.style.display = 'none';
  const tabooWrapEl = document.getElementById('genTabooWrap');
  if (tabooWrapEl) tabooWrapEl.style.display = 'none';

  const category = document.querySelector('input[name="genCategory"]:checked').value;
  const photo_context = document.getElementById('genPhotoCtx').value.trim();
  const memo = document.getElementById('genMemo').value.trim();

  const payload = { category, photo_context };
  if (memo) payload.memo = memo;

  try {
    const res = await _personaFetch('POST', '/persona/generate', payload);

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

  // 신/구 응답 키 모두 지원 (백엔드 C11 전환 전후 호환)
  const sigIds  = data.signature_block_ids_used || [];
  const taboos  = data.taboo_flags || [];
  const cached  = data.cached || data.cache_hit;
  const fewshot = data.fewshot_count ?? data.examples_used;
  const tokens  = data.token_usage ?? data.tokens;

  // 메타 줄 (서명 N개 추가)
  const parts = [];
  if (cached)            parts.push('캐시 HIT');
  if (fewshot != null)   parts.push(`예시 ${fewshot}개 참조`);
  if (sigIds.length > 0) parts.push(`서명 ${sigIds.length}개`);
  if (tokens  != null)   parts.push(`${tokens} tokens`);
  document.getElementById('genMeta').textContent = parts.join(' • ');

  document.getElementById('genResultBlock').style.display = 'block';
  document.getElementById('genError').style.display = 'none';

  // 보조 UI (async 칩은 결과 즉시 노출 후 비동기 채워짐)
  _genRenderSigChips(sigIds);
  _genRenderTaboo(taboos);

  // 결과 블록으로 부드럽게 스크롤
  document.getElementById('genResultBlock').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── 시그니처 블록 칩 렌더 ─────────────────────────────────────────
async function _genRenderSigChips(ids) {
  const wrap = document.getElementById('genSigChips');
  if (!wrap) return;
  if (!ids || ids.length === 0) { wrap.style.display = 'none'; return; }

  const sigs = await _genLoadSigCache();
  const matched = ids.map(id => sigs.find(s => s.id === id)).filter(Boolean);
  if (!matched.length) { wrap.style.display = 'none'; return; }

  const chips = matched.map(s => {
    const display = s.label || s.content || '';
    const short   = display.slice(0, 30) + (display.length > 30 ? '…' : '');
    return `<span style="display:inline-flex;align-items:center;background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:3px 10px;font-size:11px;color:var(--text2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(display)}">${_esc(short)}</span>`;
  }).join('');

  wrap.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:5px;">삽입된 서명블록</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;">${chips}</div>`;
  wrap.style.display = 'block';
}

// ── taboo 경고 렌더 ───────────────────────────────────────────────
function _genRenderTaboo(flags) {
  const wrap = document.getElementById('genTabooWrap');
  if (!wrap) return;
  if (!flags || flags.length === 0) { wrap.style.display = 'none'; return; }

  const items = flags.map(f =>
    `<li style="margin-bottom:3px;"><span style="font-weight:600;">${_esc(f.category || '')}</span> — ${_esc(f.pattern || '')}</li>`
  ).join('');

  wrap.innerHTML = `
    <details style="background:#fffbe6;border:1px solid #ffe58f;border-radius:10px;padding:8px 12px;">
      <summary style="font-size:12px;font-weight:700;color:#b8860b;cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;">
        ⚠ 광고법 주의 ${flags.length}건
      </summary>
      <ul style="margin:8px 0 0;padding-left:16px;font-size:11px;color:var(--text2);">${items}</ul>
    </details>`;
  wrap.style.display = 'block';
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
