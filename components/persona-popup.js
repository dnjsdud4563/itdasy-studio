/**
 * persona-popup.js
 * 말투분석 검증 팝업 — 토스식 Step 0~6
 *
 * Step 0: 서명블록 확인 ("고정된 글이 있나요?")
 * Step 1~3: 3축 선택 (scenario-selector.js 호출)
 * Step 4: 특이사항 자유입력 (scenario-selector 내부 처리)
 * Step 5: Mock AI 캡션 3개 + [맘에 들어요 / 다시 뽑아줘 / 살짝 고칠래요]
 * Step 6: 선택적 4단계 톤 조절
 *
 * export: openPersonaPopup()
 *
 * TODO(Phase 1-A-4): mockGenerateCaption → 실제 /persona/verify-scenario API로 교체
 */

import { renderScenarioSelector } from './scenario-selector.js';

/* ─────────────────────────────────────────────
   Mock API
   ───────────────────────────────────────────── */

/**
 * mockGenerateCaption(axes, special_context)
 * TODO(Phase 1-A-4): 실제 API로 교체
 */
function mockGenerateCaption(axes, special_context) {
  const situationText = axes.situation === '시술완성' ? '시술이 완성됐어요' : '후기 감사해요';
  const customerText  = axes.customer  === '신규'    ? '처음 오신 손님' : '오랫동안 찾아주신 단골 손님';
  const photoText     = axes.photo     === '완성샷'   ? '완성된 모습' : '전후 변화';
  const extra = special_context ? `\n${special_context}` : '';

  return [
    `오늘도 ${customerText}께 ${situationText} ✨\n${photoText}을 담았어요.${extra}\n#잇데이 #네일아트`,
    `${customerText}과 함께한 오늘 💕\n${situationText}! ${photoText}이 너무 예쁘게 나왔어요.${extra}`,
    `${situationText} 기념으로 ${photoText} 남겨요 🎉\n${customerText}이라 더 특별했어요.${extra}\n#네일`,
  ];
}

/* ─────────────────────────────────────────────
   스타일
   ───────────────────────────────────────────── */

const PP_CSS = `
.pp-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:9000;
  display:flex; align-items:flex-end; justify-content:center;
  animation: pp-bg-in .2s ease;
}
@keyframes pp-bg-in { from{opacity:0} to{opacity:1} }
.pp-sheet {
  width:100%; max-width:480px; background:#fff; border-radius:24px 24px 0 0;
  padding:28px 22px 36px; box-sizing:border-box;
  max-height:88vh; overflow-y:auto;
  animation: pp-sheet-in .22s cubic-bezier(.32,1.1,.68,1);
}
@keyframes pp-sheet-in { from{transform:translateY(60px);opacity:0} to{transform:none;opacity:1} }
.pp-handle { width:36px; height:4px; background:#e0e0e0; border-radius:2px; margin:0 auto 22px; }
.pp-title { font-size:18px; font-weight:800; color:#1a1a1a; margin-bottom:6px; line-height:1.35; }
.pp-sub   { font-size:13px; color:#888; margin-bottom:22px; line-height:1.5; }
.pp-btn {
  width:100%; padding:14px; border-radius:14px; border:none;
  font-size:15px; font-weight:700; cursor:pointer; transition:opacity .1s;
}
.pp-btn:active { opacity:.75; }
.pp-btn-primary { background:#1a1a1a; color:#fff; }
.pp-btn-ghost   { background:#f4f4f4; color:#333; margin-top:10px; }
.pp-caption-card {
  border:1.5px solid #e5e5e5; border-radius:14px; padding:14px 16px;
  margin-bottom:12px; font-size:13px; color:#222; line-height:1.65;
  white-space:pre-wrap; cursor:pointer; transition:border-color .12s;
}
.pp-caption-card.selected { border-color:#1a1a1a; background:#fafafa; }
.pp-caption-card:hover { border-color:#bbb; }
.pp-caption-actions { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; }
.pp-act-btn {
  flex:1; min-width:90px; padding:11px 6px; border-radius:12px; border:1.5px solid #e5e5e5;
  background:#fff; font-size:13px; font-weight:600; cursor:pointer; text-align:center;
  transition:border-color .12s, background .12s;
}
.pp-act-btn:hover { border-color:#aaa; }
.pp-act-btn.primary { border-color:#1a1a1a; background:#1a1a1a; color:#fff; }
.pp-tone-row { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
.pp-tone-chip {
  flex:1; min-width:70px; padding:11px 8px; border-radius:12px; border:1.5px solid #e5e5e5;
  background:#fff; font-size:13px; font-weight:600; cursor:pointer; text-align:center;
  transition:border-color .12s, background .12s, color .12s;
}
.pp-tone-chip.selected { border-color:#1a1a1a; background:#1a1a1a; color:#fff; }
.pp-signature-box {
  background:#f8f8f8; border-radius:12px; padding:12px 14px;
  font-size:13px; color:#555; line-height:1.6; margin-bottom:16px;
  white-space:pre-wrap; min-height:40px;
}
.pp-loading { text-align:center; padding:32px 0; color:#aaa; font-size:14px; }
.pp-step-anim { animation: ss-fadein .18s ease; }
@keyframes ss-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
`;

function _injectPPStyles() {
  if (document.getElementById('pp-styles')) return;
  const el = document.createElement('style');
  el.id = 'pp-styles';
  el.textContent = PP_CSS;
  document.head.appendChild(el);
}

/* ─────────────────────────────────────────────
   팝업 상태
   ───────────────────────────────────────────── */

let _overlay = null;

function _close() {
  if (_overlay) { _overlay.remove(); _overlay = null; }
}

function _buildOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'pp-overlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });

  const sheet = document.createElement('div');
  sheet.className = 'pp-sheet';
  sheet.id = 'pp-sheet';

  const handle = document.createElement('div');
  handle.className = 'pp-handle';
  sheet.appendChild(handle);

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  return { overlay, sheet };
}

function _getSheet() { return document.getElementById('pp-sheet'); }

/* ─────────────────────────────────────────────
   Step 렌더러
   ───────────────────────────────────────────── */

// Step 0: 서명블록 확인
function _renderStep0() {
  const sheet = _getSheet();
  sheet.querySelectorAll('.pp-step').forEach(el => el.remove());

  const wrap = document.createElement('div');
  wrap.className = 'pp-step pp-step-anim';

  // 실제로는 서버에서 서명 가져오지만, Mock에선 localStorage 활용
  const savedSig = localStorage.getItem('_mock_signature') || '';

  wrap.innerHTML = `
    <div class="pp-title">고정으로 들어가는 글이 있어요?</div>
    <div class="pp-sub">캡션 마지막에 항상 붙이는 말이 있으면 알려주세요.<br>없으면 그냥 넘어가도 돼요.</div>
    <div class="pp-signature-box" id="pp-sig-preview">${savedSig || '예: 예약은 DM 주세요 💌\n#잇데이네일'}</div>
    <button class="pp-btn pp-btn-primary" id="pp-sig-ok">이렇게 쓸게요</button>
    <button class="pp-btn pp-btn-ghost" id="pp-sig-no">없어요, 넘어갈게요</button>
  `;
  sheet.appendChild(wrap);

  document.getElementById('pp-sig-ok').onclick = () => _renderStep1to3(savedSig);
  document.getElementById('pp-sig-no').onclick = () => _renderStep1to3('');
}

// Step 1~3 + Step 4 (scenario-selector 위임)
function _renderStep1to3(signature) {
  const sheet = _getSheet();
  sheet.querySelectorAll('.pp-step').forEach(el => el.remove());

  const wrap = document.createElement('div');
  wrap.className = 'pp-step pp-step-anim';

  const title = document.createElement('div');
  title.className = 'pp-title';
  title.textContent = '어떤 글을 써볼까요?';
  wrap.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'pp-sub';
  sub.textContent = '세 가지만 탁탁 골라주세요. 금방 끝나요!';
  wrap.appendChild(sub);

  const selectorArea = document.createElement('div');
  wrap.appendChild(selectorArea);
  sheet.appendChild(wrap);

  renderScenarioSelector(selectorArea, ({ combo_id, axes, special_context }) => {
    _renderStep5(signature, axes, special_context);
  });
}

// Step 5: Mock 캡션 3개 + 피드백 버튼
function _renderStep5(signature, axes, special_context) {
  const sheet = _getSheet();
  sheet.querySelectorAll('.pp-step').forEach(el => el.remove());

  const wrap = document.createElement('div');
  wrap.className = 'pp-step pp-step-anim';

  const loading = document.createElement('div');
  loading.className = 'pp-loading';
  loading.textContent = '글 만드는 중이에요...';
  wrap.appendChild(loading);
  sheet.appendChild(wrap);

  // Mock 딜레이 (Phase 1-A-4에서 실제 API로 교체)
  setTimeout(() => {
    const captions = mockGenerateCaption(axes, special_context);
    if (signature) captions.forEach((_, i) => { captions[i] += '\n\n' + signature; });

    wrap.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'pp-title';
    title.textContent = '이 중에 말투가 자연스러운 게 있나요?';
    wrap.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'pp-sub';
    sub.textContent = '아직 내용이 아닌 말투만 봐주세요.';
    wrap.appendChild(sub);

    let selectedIdx = -1;

    captions.forEach((text, i) => {
      const card = document.createElement('div');
      card.className = 'pp-caption-card';
      card.textContent = text;
      card.onclick = () => {
        document.querySelectorAll('.pp-caption-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedIdx = i;
        actRow.style.display = 'flex';
      };
      wrap.appendChild(card);
    });

    const actRow = document.createElement('div');
    actRow.className = 'pp-caption-actions';
    actRow.style.display = 'none';

    const btnGood = document.createElement('button');
    btnGood.className = 'pp-act-btn primary';
    btnGood.textContent = '맘에 들어요';
    btnGood.onclick = () => _renderStep6(captions[selectedIdx], axes);

    const btnRetry = document.createElement('button');
    btnRetry.className = 'pp-act-btn';
    btnRetry.textContent = '다시 뽑아줘';
    btnRetry.onclick = () => _renderStep5(signature, axes, special_context);

    const btnEdit = document.createElement('button');
    btnEdit.className = 'pp-act-btn';
    btnEdit.textContent = '살짝 고칠래요';
    btnEdit.onclick = () => _renderStep6(captions[selectedIdx], axes, true);

    actRow.appendChild(btnGood);
    actRow.appendChild(btnRetry);
    actRow.appendChild(btnEdit);
    wrap.appendChild(actRow);

    // 하나도 안 고른 상태에서도 완전히 맘에 없을 때 처리
    const btnNone = document.createElement('button');
    btnNone.className = 'pp-btn pp-btn-ghost';
    btnNone.style.marginTop = '16px';
    btnNone.textContent = '다 별로예요, 다시 뽑아줘';
    btnNone.onclick = () => _renderStep5(signature, axes, special_context);
    wrap.appendChild(btnNone);

  }, 900);
}

// Step 6: 선택적 톤 조절
function _renderStep6(selectedCaption, axes, editMode = false) {
  const sheet = _getSheet();
  sheet.querySelectorAll('.pp-step').forEach(el => el.remove());

  const wrap = document.createElement('div');
  wrap.className = 'pp-step pp-step-anim';

  const title = document.createElement('div');
  title.className = 'pp-title';
  title.textContent = editMode ? '어떻게 고쳐볼까요?' : '톤을 조금 바꿔볼까요?';
  wrap.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'pp-sub';
  sub.textContent = '원하는 느낌이 있으면 골라주세요. 없으면 넘어가도 돼요.';
  wrap.appendChild(sub);

  const TONES = [
    { key: 'emoji',    label: '이모지 줄여줘' },
    { key: 'longer',   label: '더 길게 써줘' },
    { key: 'casual',   label: '더 친근하게' },
    { key: 'formal',   label: '좀 더 격식있게' },
  ];

  const selected = new Set();

  const toneRow = document.createElement('div');
  toneRow.className = 'pp-tone-row';
  TONES.forEach(t => {
    const chip = document.createElement('button');
    chip.className = 'pp-tone-chip';
    chip.textContent = t.label;
    chip.onclick = () => {
      chip.classList.toggle('selected');
      selected.has(t.key) ? selected.delete(t.key) : selected.add(t.key);
    };
    toneRow.appendChild(chip);
  });
  wrap.appendChild(toneRow);

  if (editMode) {
    const editLabel = document.createElement('div');
    editLabel.style.cssText = 'font-size:13px;font-weight:600;color:#555;margin:14px 0 8px;';
    editLabel.textContent = '직접 수정해도 돼요';
    wrap.appendChild(editLabel);

    const ta = document.createElement('textarea');
    ta.className = 'pp-signature-box';
    ta.style.cssText += 'width:100%;box-sizing:border-box;border:1.5px solid #e5e5e5;border-radius:12px;resize:none;outline:none;font-family:inherit;';
    ta.rows = 5;
    ta.value = selectedCaption;
    wrap.appendChild(ta);
  }

  const btnDone = document.createElement('button');
  btnDone.className = 'pp-btn pp-btn-primary';
  btnDone.style.marginTop = '16px';
  btnDone.textContent = '완료!';
  btnDone.onclick = () => {
    // TODO(Phase 1-A-4): 피드백 신호 수집 → /persona/feedback 전송
    _close();
  };
  wrap.appendChild(btnDone);

  const btnSkip = document.createElement('button');
  btnSkip.className = 'pp-btn pp-btn-ghost';
  btnSkip.textContent = '이대로 완료';
  btnSkip.onclick = () => _close();
  wrap.appendChild(btnSkip);

  sheet.appendChild(wrap);
}

/* ─────────────────────────────────────────────
   진입점
   ───────────────────────────────────────────── */

/**
 * openPersonaPopup()
 * 말투분석 검증 팝업 열기
 */
function openPersonaPopup() {
  if (_overlay) return; // 중복 방지
  _injectPPStyles();
  const { overlay } = _buildOverlay();
  _overlay = overlay;
  _renderStep0();
}

export { openPersonaPopup };
