// Itdasy Studio - 작업실 & 마무리 (갤러리, 슬롯, IndexedDB)
// 캔버스 합성은 app-portfolio.js의 공유 유틸 사용:
//   compositePersonOnCanvas(), renderBASplit(), _loadImageSrc(), _drawCoverCtx(), getCloudBg()

// ═══════════════════════════════════════════════════════
// IndexedDB
// ═══════════════════════════════════════════════════════
const _GDB_NAME = 'itdasy-gallery';
const _GDB_STORE = 'slots';
let _gdb = null;

function openGalleryDB() {
  return new Promise((resolve, reject) => {
    if (_gdb) return resolve(_gdb);
    const req = indexedDB.open(_GDB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_GDB_STORE)) {
        const store = db.createObjectStore(_GDB_STORE, { keyPath: 'id' });
        store.createIndex('order', 'order', { unique: false });
      }
    };
    req.onsuccess = e => { _gdb = e.target.result; resolve(_gdb); };
    req.onerror  = () => reject(req.error);
  });
}

async function saveSlotToDB(slot) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_GDB_STORE, 'readwrite');
    tx.objectStore(_GDB_STORE).put(slot);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function loadSlotsFromDB() {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(_GDB_STORE, 'readonly');
    const req = tx.objectStore(_GDB_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.order - b.order));
    req.onerror   = () => reject(req.error);
  });
}

async function deleteSlotFromDB(id) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_GDB_STORE, 'readwrite');
    tx.objectStore(_GDB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

// ═══════════════════════════════════════════════════════
// 유틸
// ═══════════════════════════════════════════════════════
function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function _fileToDataUrl(file) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

function _dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime  = parts[0].match(/:(.*?);/)[1];
  const bin   = atob(parts[1]);
  const arr   = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ═══════════════════════════════════════════════════════
// 상태
// ═══════════════════════════════════════════════════════
let _photos         = [];          // [{ id, file, dataUrl }] — 미배정 사진 풀
let _slots          = [];          // DB에서 로드한 슬롯 배열
let _selectedIds    = new Set();   // 탭-체크 선택된 사진 ID
let _wsInited       = false;
let _dragPhotoId    = null;
let _popupSlotId    = null;
let _popupUsage     = null;

// ═══════════════════════════════════════════════════════
// 홈 탭 퀵액션
// ═══════════════════════════════════════════════════════
function goWorkshopUpload() {
  showTab('workshop', document.querySelectorAll('.nav-btn')[1]);
  initWorkshopTab();
  setTimeout(() => {
    const inp = document.getElementById('galleryFileInput');
    if (inp) inp.click();
  }, 300);
}

// ═══════════════════════════════════════════════════════
// 작업실 탭 초기화
// ═══════════════════════════════════════════════════════
async function initWorkshopTab() {
  const root = document.getElementById('workshopRoot');
  if (!root) return;

  if (!_wsInited) {
    _wsInited = true;
    root.innerHTML = _buildWorkshopHTML();
    document.addEventListener('touchend', _onTouchEndDrag, { passive: false });
  }

  try { _slots = await loadSlotsFromDB(); } catch(_e) { _slots = []; }
  _renderPhotoGrid();
  _renderSlotCards();
}

function _buildWorkshopHTML() {
  return `
  <div class="sec-title" style="margin-bottom:4px;">작업실 📷</div>
  <div class="sec-sub" style="margin-bottom:16px;">오늘 시술 사진을 올리고, 손님별로 묶어보세요</div>

  <div style="background:var(--bg2); border:1.5px dashed rgba(241,128,145,0.4); border-radius:18px; padding:20px; text-align:center; margin-bottom:16px;" onclick="document.getElementById('galleryFileInput').click()">
    <input type="file" id="galleryFileInput" accept="image/*" multiple style="display:none;" onchange="handleGalleryUpload(this)">
    <div style="font-size:28px; margin-bottom:6px;">📷</div>
    <div style="font-size:13px; font-weight:700; color:var(--text2);">사진 올리기 (최대 20장)</div>
    <div style="font-size:11px; color:var(--text3); margin-top:3px;">탭해서 선택하거나 여러 장 한번에</div>
  </div>

  <div id="photoGrid" style="display:none; margin-bottom:16px;">
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
      <div style="font-size:12px; font-weight:800; color:var(--text);">올린 사진 <span id="photoCount">0</span>장</div>
      <div id="photoSelectActions" style="display:none; font-size:11px;"></div>
    </div>
    <div id="photoGridInner" style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px;"></div>
  </div>

  <div style="background:var(--bg2); border:1px solid var(--border); border-radius:16px; padding:16px; margin-bottom:16px;">
    <div style="font-size:12px; font-weight:800; color:var(--text); margin-bottom:12px;">오늘 몇 분 시술하셨어요?</div>
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
      ${[1,2,3,4,5].map(n => `<button onclick="createSlots(${n})" style="width:48px;height:48px;border-radius:12px;border:1.5px solid rgba(241,128,145,0.3);background:transparent;font-size:15px;font-weight:800;color:var(--text);cursor:pointer;">${n}</button>`).join('')}
      <button onclick="showCustomerInput()" style="padding:10px 14px;border-radius:12px;border:1.5px solid rgba(241,128,145,0.3);background:transparent;font-size:12px;font-weight:700;color:var(--text3);cursor:pointer;">5명 이상이에요</button>
    </div>
    <div id="customCountWrap" style="display:none; align-items:center; gap:8px;">
      <input type="number" id="customCountInput" min="6" max="15" placeholder="6~15" style="width:80px;padding:8px 12px;border-radius:10px;border:1px solid var(--border);font-size:14px;text-align:center;">
      <button onclick="createSlotsCustom()" style="padding:8px 16px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">생성</button>
    </div>
  </div>

  <div id="slotCardList"></div>
  `;
}

// ═══════════════════════════════════════════════════════
// 사진 업로드
// ═══════════════════════════════════════════════════════
async function handleGalleryUpload(input) {
  const files     = Array.from(input.files);
  const remaining = 20 - _photos.length;
  const toAdd     = files.slice(0, remaining);
  for (const file of toAdd) {
    _photos.push({ id: _uid(), file, dataUrl: await _fileToDataUrl(file) });
  }
  if (files.length > remaining) showToast(`최대 20장까지 가능해요 (${remaining}장 추가됨)`);
  input.value = '';
  _renderPhotoGrid();
}

// ═══════════════════════════════════════════════════════
// 사진 그리드
// ═══════════════════════════════════════════════════════
function _renderPhotoGrid() {
  const grid  = document.getElementById('photoGrid');
  const inner = document.getElementById('photoGridInner');
  if (!grid || !inner) return;

  const unassigned = _photos.filter(p => !_isAssigned(p.id));
  grid.style.display = unassigned.length ? 'block' : 'none';
  const countEl = document.getElementById('photoCount');
  if (countEl) countEl.textContent = unassigned.length;

  inner.innerHTML = '';
  unassigned.forEach(photo => {
    const sel  = _selectedIds.has(photo.id);
    const cell = document.createElement('div');
    cell.style.cssText = `position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;border:2.5px solid ${sel ? 'var(--accent)' : 'transparent'};cursor:pointer;`;
    cell.innerHTML = `
      <img src="${photo.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;">
      <div style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;border:2px solid #fff;background:${sel ? 'var(--accent)' : 'rgba(0,0,0,0.3)'};display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;">${sel ? '✓' : ''}</div>
      <button onclick="removeGalleryPhoto('${photo.id}',event)" style="position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:11px;cursor:pointer;z-index:2;">✕</button>
    `;
    cell.addEventListener('click', () => togglePhotoSelect(photo.id));

    // 길게 눌러 드래그
    let pt;
    cell.addEventListener('touchstart', () => { pt = setTimeout(() => { _dragPhotoId = photo.id; _showDragIndicator(photo.dataUrl); }, 500); }, { passive: true });
    cell.addEventListener('touchend',   () => clearTimeout(pt), { passive: true });
    inner.appendChild(cell);
  });

  _updateSelectActions();
}

function _isAssigned(id) {
  return _slots.some(s => s.photos?.some(p => p.id === id));
}

function removeGalleryPhoto(id, e) {
  e?.stopPropagation();
  _photos = _photos.filter(p => p.id !== id);
  _selectedIds.delete(id);
  _renderPhotoGrid();
}

function togglePhotoSelect(id) {
  _selectedIds.has(id) ? _selectedIds.delete(id) : _selectedIds.add(id);
  _renderPhotoGrid();
}

function _updateSelectActions() {
  const el = document.getElementById('photoSelectActions');
  if (!el) return;
  if (!_selectedIds.size) { el.style.display = 'none'; return; }
  el.style.display = 'block';

  const open = _slots.filter(s => s.status !== 'done');
  if (!open.length) {
    el.innerHTML = `<span style="color:var(--text3);">${_selectedIds.size}장 선택 (슬롯 먼저 생성)</span>`;
    return;
  }
  el.innerHTML = `<span style="color:var(--accent);font-weight:700;">${_selectedIds.size}장 선택</span> ` +
    open.map(s => `<button onclick="assignSelectedToSlot('${s.id}')" style="margin-left:6px;padding:4px 10px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;">${s.label}에 넣기</button>`).join('');
}

// ═══════════════════════════════════════════════════════
// 슬롯 생성
// ═══════════════════════════════════════════════════════
function showCustomerInput() {
  const w = document.getElementById('customCountWrap');
  if (w) { w.style.display = 'flex'; }
}
function createSlots(n) { _createSlots(n); }
function createSlotsCustom() {
  const n = parseInt(document.getElementById('customCountInput')?.value);
  if (!n || n < 6 || n > 15) { showToast('6~15 사이로 입력해주세요'); return; }
  _createSlots(n);
}

async function _createSlots(n) {
  const base = _slots.length;
  for (let i = 0; i < n; i++) {
    const slot = { id: _uid(), label: `손님 ${base + i + 1}`, order: base + i, photos: [], caption: '', hashtags: '', status: 'open' };
    _slots.push(slot);
    try { await saveSlotToDB(slot); } catch(_e) {}
  }
  _renderSlotCards();
  showToast(`슬롯 ${n}개 생성됐어요 ✨`);
}

// ═══════════════════════════════════════════════════════
// 슬롯 카드
// ═══════════════════════════════════════════════════════
function _renderSlotCards() {
  const list = document.getElementById('slotCardList');
  if (!list) return;
  if (!_slots.length) { list.innerHTML = ''; return; }

  list.innerHTML = `<div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:10px;">손님 슬롯 ${_slots.length}개</div>`;

  _slots.forEach(slot => {
    const done   = slot.status === 'done';
    const thumbs = (slot.photos || []).slice(0, 3).map(p =>
      `<img src="${p.editedDataUrl || p.dataUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;border:1px solid var(--border);">`
    ).join('') || `<div style="width:40px;height:40px;border-radius:8px;border:1.5px dashed rgba(241,128,145,0.3);display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--text3);">+</div>`;

    const card = document.createElement('div');
    card.style.cssText = `background:#fff;border:1.5px solid ${done ? 'rgba(76,175,80,0.4)' : 'var(--border)'};border-radius:16px;padding:14px;margin-bottom:10px;cursor:pointer;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="display:flex;gap:4px;">${thumbs}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:800;color:var(--text);">${slot.label}${done ? ' ✅' : ''}</div>
          <div style="font-size:11px;color:var(--text3);">${slot.photos.length}장 · ${done ? '완료' : '편집 대기'}</div>
        </div>
        <button onclick="deleteSlot('${slot.id}',event)" style="background:transparent;border:none;font-size:16px;color:var(--text3);cursor:pointer;padding:4px;">🗑</button>
      </div>
      ${!slot.photos.length ? `<div id="dz_${slot.id}" style="margin-top:10px;border:1.5px dashed rgba(241,128,145,0.35);border-radius:10px;padding:12px;text-align:center;font-size:11px;color:var(--text3);">사진을 드래그하거나 위에서 선택 후 배정</div>` : ''}
    `;
    card.addEventListener('click', () => openSlotPopup(slot.id));

    const dz = card.querySelector(`#dz_${slot.id}`);
    if (dz) {
      dz.addEventListener('touchend', e => {
        if (_dragPhotoId) {
          e.preventDefault();
          _assignToSlot(_dragPhotoId, slot.id);
          _hideDragIndicator();
          _dragPhotoId = null;
        }
      }, { passive: false });
    }
    list.appendChild(card);
  });
}

function assignSelectedToSlot(slotId) {
  if (!_selectedIds.size) return;
  [..._selectedIds].forEach(id => _assignToSlot(id, slotId));
  _selectedIds.clear();
  _renderPhotoGrid();
  _renderSlotCards();
  showToast('사진 배정 완료');
}

function _assignToSlot(photoId, slotId) {
  const photo = _photos.find(p => p.id === photoId);
  const slot  = _slots.find(s => s.id === slotId);
  if (!photo || !slot || slot.photos.find(p => p.id === photoId)) return;
  slot.photos.push({ id: photo.id, dataUrl: photo.dataUrl, mode: 'original', editedDataUrl: null });
  saveSlotToDB(slot).catch(() => {});
}

async function deleteSlot(slotId, e) {
  e?.stopPropagation();
  if (!confirm('슬롯을 삭제할까요?')) return;
  _slots = _slots.filter(s => s.id !== slotId);
  try { await deleteSlotFromDB(slotId); } catch(_e) {}
  _renderSlotCards();
}

// ═══════════════════════════════════════════════════════
// 드래그 인디케이터 (Touch API)
// ═══════════════════════════════════════════════════════
function _showDragIndicator(dataUrl) {
  let ind = document.getElementById('_gDragInd');
  if (!ind) {
    ind = document.createElement('div');
    ind.id = '_gDragInd';
    ind.style.cssText = 'position:fixed;width:60px;height:60px;border-radius:10px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.25);pointer-events:none;z-index:9999;opacity:0.85;display:none;';
    ind.innerHTML = '<img style="width:100%;height:100%;object-fit:cover;">';
    document.body.appendChild(ind);
  }
  ind.querySelector('img').src = dataUrl;
  ind.style.display = 'block';
  document.addEventListener('touchmove', _moveDragInd, { passive: true });
}

function _moveDragInd(e) {
  const ind = document.getElementById('_gDragInd');
  if (!ind || !_dragPhotoId) return;
  const t = e.touches[0];
  ind.style.left = (t.clientX - 30) + 'px';
  ind.style.top  = (t.clientY - 30) + 'px';
}

function _hideDragIndicator() {
  const ind = document.getElementById('_gDragInd');
  if (ind) ind.style.display = 'none';
  document.removeEventListener('touchmove', _moveDragInd);
}

function _onTouchEndDrag() {
  if (_dragPhotoId) { _hideDragIndicator(); _dragPhotoId = null; }
}

// ═══════════════════════════════════════════════════════
// 슬롯 팝업
// ═══════════════════════════════════════════════════════
async function openSlotPopup(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot) return;
  _popupSlotId = slotId;

  const popup = document.getElementById('slotPopup');
  document.getElementById('slotPopupLabel').textContent = slot.label;
  popup.style.display = 'flex';

  try {
    const res = await fetch(API + '/image/usage', { headers: authHeader() });
    if (res.ok) _popupUsage = await res.json();
  } catch(_e) { _popupUsage = null; }

  _renderPopupBody(slot);
}

function closeSlotPopup() {
  const popup = document.getElementById('slotPopup');
  if (popup) popup.style.display = 'none';
  _popupSlotId = null;
  _renderSlotCards();
}

async function saveAndCloseSlotPopup() {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (slot) { slot.status = 'done'; try { await saveSlotToDB(slot); } catch(_e) {} }
  closeSlotPopup();
}

function _renderPopupBody(slot) {
  const body = document.getElementById('slotPopupBody');
  if (!body) return;

  const usageHtml = _popupUsage
    ? `<div style="font-size:11px;color:var(--text3);margin-bottom:12px;">AI 누끼따기 남은 횟수: <b style="color:var(--accent);">${_popupUsage.limit - _popupUsage.used}/${_popupUsage.limit}회</b></div>`
    : '';

  body.innerHTML = `
    ${usageHtml}
    <div style="margin-bottom:14px;">
      <input type="file" id="popupPhotoInput" accept="image/*" multiple style="display:none;" onchange="addPhotosToPopup(this)">
      <button onclick="document.getElementById('popupPhotoInput').click()" style="width:100%;padding:12px;border-radius:12px;border:1.5px dashed rgba(241,128,145,0.4);background:transparent;color:var(--accent2);font-size:12px;font-weight:700;cursor:pointer;">+ 사진 추가</button>
    </div>
    <div id="popupPhotoList"></div>
    <div id="popupProgress" style="display:none;text-align:center;padding:20px;font-size:13px;color:var(--text3);">AI 처리 중... ⏳</div>
  `;
  _renderPopupPhotoList(slot);
}

function _renderPopupPhotoList(slot) {
  const list = document.getElementById('popupPhotoList');
  if (!list) return;

  if (!slot.photos?.length) {
    list.innerHTML = '<div style="text-align:center;padding:20px;font-size:13px;color:var(--text3);">사진을 추가해주세요</div>';
    return;
  }

  const modeLabel = { original: '원본', ai_bg: 'AI 배경합성', ba: 'B·A 합성' };
  list.innerHTML = '';
  slot.photos.forEach((photo, idx) => {
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:12px;margin-bottom:10px;';
    card.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <img src="${photo.editedDataUrl || photo.dataUrl}" style="width:72px;height:72px;object-fit:cover;border-radius:10px;flex-shrink:0;">
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;">사진 ${idx + 1}</div>
          <div style="font-size:11px;color:var(--accent2);margin-bottom:8px;">현재: ${modeLabel[photo.mode] || '원본'}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            ${['original','ai_bg','ba'].map(m => {
              const on = photo.mode === m;
              return `<button onclick="setPopupPhotoMode('${photo.id}','${m}')" style="padding:5px 10px;border-radius:8px;border:1px solid ${on?'var(--accent)':'var(--border)'};background:${on?'rgba(241,128,145,0.1)':'transparent'};color:${on?'var(--accent)':'var(--text3)'};font-size:10px;font-weight:700;cursor:pointer;">${modeLabel[m]}</button>`;
            }).join('')}
          </div>
        </div>
        <button onclick="removePopupPhoto('${photo.id}')" style="background:transparent;border:none;font-size:18px;color:var(--text3);cursor:pointer;flex-shrink:0;">✕</button>
      </div>
    `;
    list.appendChild(card);
  });
}

async function addPhotosToPopup(input) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  for (const file of Array.from(input.files)) {
    const dataUrl = await _fileToDataUrl(file);
    const id = _uid();
    slot.photos.push({ id, dataUrl, mode: 'original', editedDataUrl: null });
    _photos.push({ id, file, dataUrl });
  }
  input.value = '';
  try { await saveSlotToDB(slot); } catch(_e) {}
  _renderPopupPhotoList(slot);
}

async function removePopupPhoto(photoId) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  slot.photos = slot.photos.filter(p => p.id !== photoId);
  try { await saveSlotToDB(slot); } catch(_e) {}
  _renderPopupPhotoList(slot);
}

async function setPopupPhotoMode(photoId, mode) {
  const slot  = _slots.find(s => s.id === _popupSlotId);
  const photo = slot?.photos.find(p => p.id === photoId);
  if (!slot || !photo) return;

  if (mode === 'ai_bg') {
    if (!confirm('AI 누끼따기는 서버 비용이 발생해요.\n진행할까요?')) return;
    if (_popupUsage && _popupUsage.used >= _popupUsage.limit) {
      showToast('오늘 누끼따기 한도를 초과했어요');
      return;
    }
    await _applyAiBg(photo, slot);
    return;
  }
  if (mode === 'ba') {
    await _applyBA(photo, slot);
    return;
  }
  // 원본
  photo.mode = 'original';
  photo.editedDataUrl = null;
  try { await saveSlotToDB(slot); } catch(_e) {}
  _renderPopupPhotoList(slot);
}

// AI 배경합성 — /image/remove-bg 호출 후 compositePersonOnCanvas() 사용
async function _applyAiBg(photo, slot) {
  const progress = document.getElementById('popupProgress');
  if (progress) progress.style.display = 'block';
  try {
    const blob = _dataUrlToBlob(photo.dataUrl);
    const fd   = new FormData();
    fd.append('file', blob, 'photo.jpg');

    const res = await fetch(API + '/image/remove-bg', { method: 'POST', headers: authHeader(), body: fd });

    if (res.status === 429) {
      showToast((await res.json().catch(() => ({}))).detail || '오늘 누끼따기 한도를 초과했어요');
      return;
    }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'API 오류');

    const url       = URL.createObjectURL(await res.blob());
    const personImg = await _loadImageSrc(url);   // app-portfolio.js 공유 유틸
    URL.revokeObjectURL(url);

    const canvas = document.createElement('canvas');
    // compositePersonOnCanvas: app-portfolio.js 공유 유틸
    await compositePersonOnCanvas(canvas, personImg, 1080, 1350, 'cloud_bw', null);

    photo.editedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    photo.mode = 'ai_bg';
    if (_popupUsage) _popupUsage.used++;

    try { await saveSlotToDB(slot); } catch(_e) {}
    _renderPopupPhotoList(slot);
  } catch(e) {
    showToast('오류: ' + e.message);
  }
  if (progress) progress.style.display = 'none';
}

// BA 합성 — renderBASplit() 사용 (app-portfolio.js 공유 유틸)
async function _applyBA(photo, slot) {
  const progress = document.getElementById('popupProgress');
  if (progress) progress.style.display = 'block';
  try {
    const photoIdx  = slot.photos.findIndex(p => p.id === photo.id);
    const afterSrc  = slot.photos[photoIdx + 1]?.dataUrl || photo.dataUrl;
    const beforeImg = await _loadImageSrc(photo.dataUrl);
    const afterImg  = await _loadImageSrc(afterSrc);

    const canvas = document.createElement('canvas');
    renderBASplit(canvas, beforeImg, afterImg, 1080, 1080);  // app-portfolio.js 공유 유틸

    photo.editedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    photo.mode = 'ba';

    try { await saveSlotToDB(slot); } catch(_e) {}
    _renderPopupPhotoList(slot);
  } catch(e) {
    showToast('오류: ' + e.message);
  }
  if (progress) progress.style.display = 'none';
}

// ═══════════════════════════════════════════════════════
// 마무리 탭
// ═══════════════════════════════════════════════════════
async function initFinishTab() {
  const root = document.getElementById('finishRoot');
  if (!root) return;
  try { _slots = await loadSlotsFromDB(); } catch(_e) { _slots = []; }
  _renderFinishTab(root);
}

function _renderFinishTab(root) {
  if (!_slots.length) {
    root.innerHTML = `
      <div class="sec-title" style="margin-bottom:4px;">마무리 🎀</div>
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:40px;margin-bottom:12px;">📭</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">작업실에서 슬롯을 먼저 만들어보세요</div>
        <button onclick="showTab('workshop',document.querySelectorAll('.nav-btn')[1]); initWorkshopTab();" style="margin-top:16px;padding:10px 20px;border-radius:12px;border:1.5px solid var(--accent2);background:transparent;color:var(--accent2);font-weight:700;cursor:pointer;font-size:12px;">작업실로 이동 →</button>
      </div>
    `;
    return;
  }

  const slotsHtml = _slots.map(slot => {
    const thumbs = (slot.photos || []).slice(0, 2).map(p =>
      `<img src="${p.editedDataUrl || p.dataUrl}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;">`
    ).join('') || '<div style="width:56px;height:56px;border-radius:8px;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:20px;">📷</div>';

    const cap = slot.caption ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${slot.caption.slice(0,40)}...</div>` : '';

    return `
      <div style="background:#fff;border:1.5px solid var(--border);border-radius:16px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">
          <div style="display:flex;gap:4px;">${thumbs}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:800;color:var(--text);">${slot.label}</div>
            <div style="font-size:11px;color:var(--text3);">${slot.photos.length}장</div>
            ${cap}
          </div>
          <button onclick="openSlotPopup('${slot.id}')" style="padding:6px 12px;border-radius:10px;border:1px solid var(--border);background:transparent;font-size:11px;color:var(--text2);cursor:pointer;font-weight:600;">편집</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button onclick="publishSlotToInstagram('${slot.id}')" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:13px;font-weight:800;cursor:pointer;">📸 인스타에 올리기</button>
          <div style="display:flex;gap:6px;">
            <button onclick="writeSlotCaption('${slot.id}')" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid rgba(241,128,145,0.3);background:transparent;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;">✍️ 글쓰기</button>
            <button onclick="downloadSlotPhotos('${slot.id}')" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text2);font-size:11px;font-weight:700;cursor:pointer;">📥 폰에 저장</button>
            <button onclick="deleteSlotFinish('${slot.id}')" style="padding:10px 12px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text3);font-size:11px;cursor:pointer;">취소</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  root.innerHTML = `
    <div class="sec-title" style="margin-bottom:4px;">마무리 🎀</div>
    <div class="sec-sub" style="margin-bottom:16px;">슬롯 ${_slots.length}개 · 원하는 방법으로 마무리하세요</div>
    ${slotsHtml}
  `;
}

async function publishSlotToInstagram(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot?.photos.length) { showToast('사진이 없어요'); return; }

  const photo      = slot.photos[0];
  const fullCaption = (slot.caption || '') + (slot.hashtags ? '\n\n' + slot.hashtags : '');

  try {
    const blob = _dataUrlToBlob(photo.editedDataUrl || photo.dataUrl);
    const fd   = new FormData();
    fd.append('image', blob, 'slot_photo.jpg');
    fd.append('photo_type', 'after');
    fd.append('main_tag', slot.label);
    fd.append('tags', '');

    const upRes = await fetch(API + '/portfolio', { method: 'POST', headers: authHeader(), body: fd });
    if (!upRes.ok) { showToast('업로드 실패'); return; }

    const upData  = await upRes.json();
    const imageUrl = upData.image_url?.startsWith('http') ? upData.image_url : API + (upData.image_url || '');

    if (typeof doInstagramPublish === 'function') {
      await doInstagramPublish(imageUrl, fullCaption);
      slot.status = 'done';
      await saveSlotToDB(slot);
      initFinishTab();
    }
  } catch(e) { showToast('오류: ' + e.message); }
}

function writeSlotCaption(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  showTab('caption', document.querySelectorAll('.nav-btn')[2]);
  if (slot) {
    setTimeout(() => {
      const memo = document.getElementById('captionMemo');
      if (memo) memo.value = slot.label + ' 시술 완료';
    }, 100);
  }
}

function downloadSlotPhotos(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot?.photos.length) { showToast('사진이 없어요'); return; }
  slot.photos.forEach((p, i) => {
    const a   = document.createElement('a');
    a.download = `itdasy_${slot.label}_${i + 1}_${Date.now()}.jpg`;
    a.href    = p.editedDataUrl || p.dataUrl;
    a.click();
  });
}

async function deleteSlotFinish(slotId) {
  if (!confirm('슬롯을 삭제할까요?')) return;
  _slots = _slots.filter(s => s.id !== slotId);
  try { await deleteSlotFromDB(slotId); } catch(_e) {}
  initFinishTab();
}
