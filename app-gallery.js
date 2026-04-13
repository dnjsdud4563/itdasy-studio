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
let _photos         = [];        // [{ id, file, dataUrl }] — 미배정 사진 풀
let _slots          = [];        // IndexedDB에서 로드
let _selectedIds    = new Set(); // 그리드 탭-체크 선택 (사진 배정용)
let _slotCheckIds   = new Set(); // 슬롯 카드 체크박스 선택 (일괄 삭제용)
let _popupSelIds    = new Set(); // 팝업 내 사진 선택 (일괄 편집용)
let _wsInited       = false;
let _dragPhotoId    = null;
let _dragSrcEl      = null;
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
    _initDragEvents();
  }

  try { _slots = await loadSlotsFromDB(); } catch(_e) { _slots = []; }
  _renderPhotoGrid();
  _renderSlotCards();
  _renderCompletionBanner();
}

function _buildWorkshopHTML() {
  return `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
    <div class="sec-title" style="margin:0;">작업실 📷</div>
    <div id="wsCompletionBadge" style="font-size:11px;font-weight:700;color:var(--accent2);"></div>
  </div>
  <div class="sec-sub" style="margin-bottom:16px;">오늘 시술 사진을 올리고, 손님별로 묶어보세요</div>

  <!-- 사진 올리기 -->
  <div id="photoUploadArea" style="background:var(--bg2);border:1.5px dashed rgba(241,128,145,0.4);border-radius:18px;padding:20px;text-align:center;margin-bottom:16px;cursor:pointer;" onclick="document.getElementById('galleryFileInput').click()">
    <input type="file" id="galleryFileInput" accept="image/*" multiple style="display:none;" onchange="handleGalleryUpload(this)">
    <div style="font-size:28px;margin-bottom:6px;">📷</div>
    <div style="font-size:13px;font-weight:700;color:var(--text2);">사진 올리기 (최대 20장)</div>
    <div style="font-size:11px;color:var(--text3);margin-top:3px;">탭하거나 PC에서 드래그해도 돼요</div>
  </div>

  <!-- 미배정 사진 그리드 -->
  <div id="photoGrid" style="display:none;margin-bottom:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:800;color:var(--text);">미배정 사진 <span id="photoCount">0</span>장</div>
      <div id="photoSelectActions" style="font-size:11px;"></div>
    </div>
    <div id="photoGridInner" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;"></div>
  </div>

  <!-- 손님 수 선택 -->
  <div id="slotCreateSection" style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="font-size:12px;font-weight:800;color:var(--text);">오늘 몇 분 시술하셨어요?</div>
      <button id="slotCreateCloseBtn" onclick="_hideSlotCreate()" style="display:none;background:transparent;border:none;font-size:18px;color:var(--text3);cursor:pointer;">×</button>
    </div>
    <div id="slotCreateBody">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        ${[1,2,3,4,5].map(n => `<button onclick="createSlots(${n})" style="width:48px;height:48px;border-radius:12px;border:1.5px solid rgba(241,128,145,0.3);background:transparent;font-size:15px;font-weight:800;color:var(--text);cursor:pointer;">${n}</button>`).join('')}
        <button onclick="showCustomerInput()" style="padding:10px 14px;border-radius:12px;border:1.5px solid rgba(241,128,145,0.3);background:transparent;font-size:12px;font-weight:700;color:var(--text3);cursor:pointer;">5명 이상이에요</button>
      </div>
      <div id="customCountWrap" style="display:none;align-items:center;gap:8px;">
        <input type="number" id="customCountInput" min="6" max="15" placeholder="6~15" style="width:80px;padding:8px 12px;border-radius:10px;border:1px solid var(--border);font-size:14px;text-align:center;">
        <button onclick="createSlotsCustom()" style="padding:8px 16px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">생성</button>
      </div>
    </div>
    <div id="slotCreatedMsg" style="display:none;font-size:11px;color:var(--text3);">
      슬롯이 생성됐어요. <button onclick="_showSlotCreate()" style="background:transparent;border:none;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;padding:0;">+ 슬롯 더 추가</button>
    </div>
  </div>

  <!-- 슬롯 목록 -->
  <div id="slotCardHeader" style="display:none;margin-bottom:8px;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:12px;font-weight:800;color:var(--text);">손님 슬롯 <span id="slotCount">0</span>개</div>
      <button id="slotBatchDeleteBtn" onclick="_batchDeleteSlots()" style="display:none;padding:5px 12px;border-radius:8px;border:1px solid rgba(220,53,69,0.4);background:transparent;color:#dc3545;font-size:11px;font-weight:700;cursor:pointer;">선택 삭제</button>
    </div>
  </div>
  <div id="slotCardList" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px;"></div>
  <div id="wsBanner" style="display:none;"></div>
  `;
}

// ═══════════════════════════════════════════════════════
// 손님 수 선택 섹션 토글
// ═══════════════════════════════════════════════════════
function _hideSlotCreate() {
  const body = document.getElementById('slotCreateBody');
  const msg  = document.getElementById('slotCreatedMsg');
  const closeBtn = document.getElementById('slotCreateCloseBtn');
  if (body) body.style.display = 'none';
  if (msg)  msg.style.display  = 'block';
  if (closeBtn) closeBtn.style.display = 'none';
}

function _showSlotCreate() {
  const body = document.getElementById('slotCreateBody');
  const msg  = document.getElementById('slotCreatedMsg');
  const closeBtn = document.getElementById('slotCreateCloseBtn');
  if (body) body.style.display = 'block';
  if (msg)  msg.style.display  = 'none';
  if (closeBtn) closeBtn.style.display = 'block';
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
  // 사진 올리면 슬롯 생성 섹션으로 스크롤
  if (_slots.length === 0) {
    setTimeout(() => {
      const el = document.getElementById('slotCreateSection');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 200);
  }
}

// ═══════════════════════════════════════════════════════
// 사진 그리드 (미배정)
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
    cell.dataset.photoId = photo.id;
    cell.dataset.dataUrl = photo.dataUrl;
    cell.style.cssText = `position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;border:2.5px solid ${sel ? 'var(--accent)' : 'transparent'};cursor:grab;user-select:none;`;
    cell.innerHTML = `
      <img src="${photo.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;">
      <div style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;border:2px solid #fff;background:${sel ? 'var(--accent)' : 'rgba(0,0,0,0.3)'};display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;">${sel ? '✓' : ''}</div>
      <button onclick="removeGalleryPhoto('${photo.id}',event)" style="position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:11px;cursor:pointer;z-index:2;">✕</button>
    `;
    cell.addEventListener('click', e => { if (!e._fromDrag) togglePhotoSelect(photo.id); });

    // Touch 드래그
    let _pt;
    cell.addEventListener('touchstart', () => {
      _pt = setTimeout(() => _startDrag(photo.id, photo.dataUrl, cell), 400);
    }, { passive: true });
    cell.addEventListener('touchend', () => clearTimeout(_pt), { passive: true });

    // Mouse 드래그 (PC)
    cell.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      _dragSrcEl = cell;
      const onMove = mv => {
        if (Math.abs(mv.clientX - e.clientX) > 5 || Math.abs(mv.clientY - e.clientY) > 5) {
          _startDrag(photo.id, photo.dataUrl, cell);
          document.removeEventListener('mousemove', onMove);
        }
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

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
  if (!_selectedIds.size) { el.innerHTML = ''; return; }
  const open = _slots.filter(s => s.status !== 'done');
  if (!open.length) {
    el.innerHTML = `<span style="color:var(--text3);">${_selectedIds.size}장 선택</span>`;
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
  if (w) w.style.display = 'flex';
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
  _hideSlotCreate();
  _renderSlotCards();
  _renderCompletionBanner();
  showToast(`슬롯 ${n}개 생성됐어요 ✨`);
}

// ═══════════════════════════════════════════════════════
// 슬롯 카드 (2열 그리드)
// ═══════════════════════════════════════════════════════
function _renderSlotCards() {
  const list   = document.getElementById('slotCardList');
  const header = document.getElementById('slotCardHeader');
  const countEl= document.getElementById('slotCount');
  if (!list) return;

  if (!_slots.length) {
    list.innerHTML = '';
    if (header) header.style.display = 'none';
    return;
  }

  if (header) header.style.display = 'block';
  if (countEl) countEl.textContent = _slots.length;

  list.innerHTML = '';
  _slots.forEach(slot => {
    const done    = slot.status === 'done';
    const checked = _slotCheckIds.has(slot.id);
    const thumb   = (slot.photos || [])[0];
    const thumbHtml = thumb
      ? `<img src="${thumb.editedDataUrl || thumb.dataUrl}" style="width:100%;height:72px;object-fit:cover;border-radius:8px;margin-bottom:8px;">`
      : `<div style="width:100%;height:72px;border-radius:8px;border:1.5px dashed rgba(241,128,145,0.3);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--text3);margin-bottom:8px;">+</div>`;

    const card = document.createElement('div');
    card.style.cssText = `position:relative;background:#fff;border:1.5px solid ${done ? 'rgba(76,175,80,0.5)' : 'var(--border)'};border-radius:14px;padding:10px;cursor:pointer;${checked ? 'box-shadow:0 0 0 2px var(--accent);' : ''}`;
    card.dataset.slotId = slot.id;
    card.innerHTML = `
      <div style="position:absolute;top:6px;left:6px;z-index:2;">
        <div onclick="toggleSlotCheck('${slot.id}',event)" style="width:18px;height:18px;border-radius:5px;border:2px solid ${checked?'var(--accent)':'rgba(0,0,0,0.25)'};background:${checked?'var(--accent)':'#fff'};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;cursor:pointer;">${checked?'✓':''}</div>
      </div>
      <button onclick="deleteSlot('${slot.id}',event)" style="position:absolute;top:5px;right:5px;z-index:2;background:transparent;border:none;font-size:14px;color:var(--text3);cursor:pointer;line-height:1;">✕</button>
      ${thumbHtml}
      <div style="font-size:11px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${slot.label}${done ? ' ✅' : ''}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px;">${slot.photos.length}장 · ${done ? '완료' : '편집 대기'}</div>
      ${!slot.photos.length ? `<div id="dz_${slot.id}" style="position:absolute;inset:0;border-radius:14px;border:2px dashed rgba(241,128,145,0);transition:border-color 0.2s;"></div>` : ''}
    `;
    card.addEventListener('click', () => openSlotPopup(slot.id)); // 완료여도 항상 열림

    // 드롭존 (터치/마우스 공용)
    const dz = card.querySelector(`#dz_${slot.id}`);
    if (dz) {
      dz.addEventListener('touchend', e => {
        if (_dragPhotoId) { e.preventDefault(); _dropToSlot(slot.id); }
      }, { passive: false });
      dz.addEventListener('mouseup', () => { if (_dragPhotoId) _dropToSlot(slot.id); });
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; });
      dz.addEventListener('dragleave', () => { dz.style.borderColor = ''; });
      dz.addEventListener('drop', e => { e.preventDefault(); dz.style.borderColor = ''; if (_dragPhotoId) _dropToSlot(slot.id); });
    }
    list.appendChild(card);
  });

  // 체크박스 선택 시 일괄 삭제 버튼 표시
  const batchBtn = document.getElementById('slotBatchDeleteBtn');
  if (batchBtn) batchBtn.style.display = _slotCheckIds.size > 0 ? 'block' : 'none';
}

function toggleSlotCheck(slotId, e) {
  e?.stopPropagation();
  _slotCheckIds.has(slotId) ? _slotCheckIds.delete(slotId) : _slotCheckIds.add(slotId);
  _renderSlotCards();
}

async function _batchDeleteSlots() {
  if (!_slotCheckIds.size) return;
  if (!confirm(`선택한 슬롯 ${_slotCheckIds.size}개를 삭제할까요?`)) return;
  for (const id of _slotCheckIds) {
    _slots = _slots.filter(s => s.id !== id);
    try { await deleteSlotFromDB(id); } catch(_e) {}
  }
  _slotCheckIds.clear();
  _renderSlotCards();
  _renderPhotoGrid();
  _renderCompletionBanner();
}

async function deleteSlot(slotId, e) {
  e?.stopPropagation();
  const slot = _slots.find(s => s.id === slotId);
  // 배정된 사진들을 미배정 풀로 복귀
  if (slot) {
    slot.photos.forEach(sp => {
      if (!_photos.find(p => p.id === sp.id)) {
        _photos.push({ id: sp.id, file: null, dataUrl: sp.dataUrl });
      }
    });
  }
  _slots = _slots.filter(s => s.id !== slotId);
  _slotCheckIds.delete(slotId);
  try { await deleteSlotFromDB(slotId); } catch(_e) {}
  _renderSlotCards();
  _renderPhotoGrid();
  _renderCompletionBanner();
}

// ═══════════════════════════════════════════════════════
// 완료 현황 배너
// ═══════════════════════════════════════════════════════
function _renderCompletionBanner() {
  const badge  = document.getElementById('wsCompletionBadge');
  const banner = document.getElementById('wsBanner');
  if (!_slots.length) {
    if (badge)  badge.textContent  = '';
    if (banner) banner.style.display = 'none';
    return;
  }
  const done  = _slots.filter(s => s.status === 'done').length;
  const total = _slots.length;
  if (badge) badge.textContent = `${done}/${total} 완료`;

  if (banner) {
    if (done === total) {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div style="background:rgba(241,128,145,0.07);border:1.5px solid rgba(241,128,145,0.2);border-radius:16px;padding:14px 16px;text-align:center;">
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:8px;">🎉 모든 손님 작업이 완료됐어요!</div>
          <button onclick="showTab('caption',document.querySelectorAll('.nav-btn')[2]); initCaptionSlotPicker();" style="padding:10px 20px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:12px;font-weight:800;cursor:pointer;">글쓰기로 이동 ✍️</button>
        </div>
      `;
    } else {
      banner.style.display = 'none';
    }
  }
}

// ═══════════════════════════════════════════════════════
// 사진 배정
// ═══════════════════════════════════════════════════════
function assignSelectedToSlot(slotId) {
  if (!_selectedIds.size) return;
  [..._selectedIds].forEach(id => _assignToSlot(id, slotId));
  _selectedIds.clear();
  _renderPhotoGrid();
  _renderSlotCards();
  showToast('배정 완료 ✅');
}

function _assignToSlot(photoId, slotId) {
  const photo = _photos.find(p => p.id === photoId);
  const slot  = _slots.find(s => s.id === slotId);
  if (!photo || !slot || slot.photos.find(p => p.id === photoId)) return;
  slot.photos.push({ id: photo.id, dataUrl: photo.dataUrl, mode: 'original', editedDataUrl: null });
  saveSlotToDB(slot).catch(() => {});
}

function _dropToSlot(slotId) {
  if (!_dragPhotoId) return;
  _assignToSlot(_dragPhotoId, slotId);
  _hideDragIndicator();
  _dragPhotoId = null;
  _renderPhotoGrid();
  _renderSlotCards();
}

// ═══════════════════════════════════════════════════════
// 드래그 (Touch + Mouse)
// ═══════════════════════════════════════════════════════
function _initDragEvents() {
  document.addEventListener('touchmove',  _moveDragInd, { passive: true });
  document.addEventListener('mousemove',  _moveDragIndMouse);
  document.addEventListener('touchend',   _onDragEnd, { passive: false });
  document.addEventListener('mouseup',    _onDragEnd);
}

function _startDrag(photoId, dataUrl, el) {
  _dragPhotoId = photoId;
  _dragSrcEl   = el;
  _showDragIndicator(dataUrl);
}

function _showDragIndicator(dataUrl) {
  let ind = document.getElementById('_gDragInd');
  if (!ind) {
    ind = document.createElement('div');
    ind.id = '_gDragInd';
    ind.style.cssText = 'position:fixed;width:60px;height:60px;border-radius:10px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.25);pointer-events:none;z-index:9999;opacity:0.85;display:none;transition:none;';
    ind.innerHTML = '<img style="width:100%;height:100%;object-fit:cover;">';
    document.body.appendChild(ind);
  }
  ind.querySelector('img').src = dataUrl;
  ind.style.display = 'block';
}

function _moveDragInd(e) {
  if (!_dragPhotoId) return;
  const ind = document.getElementById('_gDragInd');
  if (!ind) return;
  const t = e.touches[0];
  ind.style.left = (t.clientX - 30) + 'px';
  ind.style.top  = (t.clientY - 30) + 'px';
}

function _moveDragIndMouse(e) {
  if (!_dragPhotoId) return;
  const ind = document.getElementById('_gDragInd');
  if (!ind) return;
  ind.style.left = (e.clientX - 30) + 'px';
  ind.style.top  = (e.clientY - 30) + 'px';
}

function _hideDragIndicator() {
  const ind = document.getElementById('_gDragInd');
  if (ind) ind.style.display = 'none';
}

function _onDragEnd() {
  if (_dragPhotoId) { _hideDragIndicator(); _dragPhotoId = null; _dragSrcEl = null; }
}

// ═══════════════════════════════════════════════════════
// 슬롯 팝업 (풀스크린)
// ═══════════════════════════════════════════════════════
async function openSlotPopup(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot) return;
  _popupSlotId = slotId;
  _popupSelIds.clear();

  document.getElementById('slotPopupLabel').textContent = slot.label + (slot.status === 'done' ? ' ✅' : '');
  document.getElementById('slotPopup').style.display = 'flex';

  try {
    const res = await fetch(API + '/image/usage', { headers: authHeader() });
    if (res.ok) _popupUsage = await res.json();
  } catch(_e) { _popupUsage = null; }

  _renderPopupBody(slot);
}

function closeSlotPopup() {
  document.getElementById('slotPopup').style.display = 'none';
  _popupSlotId = null;
  _popupSelIds.clear();
  _renderSlotCards();
  _renderPhotoGrid();
}

async function saveAndCloseSlotPopup() {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (slot) {
    slot.status = 'done';
    try { await saveSlotToDB(slot); } catch(_e) {}
  }
  closeSlotPopup();
  _renderCompletionBanner();
}

function _renderPopupBody(slot) {
  const body = document.getElementById('slotPopupBody');
  if (!body) return;

  const usageHtml = _popupUsage
    ? `<div style="font-size:11px;color:var(--text3);margin-bottom:12px;">AI 누끼따기 남은 횟수: <b style="color:var(--accent);">${_popupUsage.limit - _popupUsage.used}/${_popupUsage.limit}회</b></div>`
    : '';

  body.innerHTML = `
    ${usageHtml}
    <!-- 사진 추가 -->
    <div style="margin-bottom:12px;">
      <input type="file" id="popupPhotoInput" accept="image/*" multiple style="display:none;" onchange="addPhotosToPopup(this)">
      <button onclick="document.getElementById('popupPhotoInput').click()" style="width:100%;padding:11px;border-radius:12px;border:1.5px dashed rgba(241,128,145,0.4);background:transparent;color:var(--accent2);font-size:12px;font-weight:700;cursor:pointer;">+ 사진 추가</button>
    </div>
    <!-- 사진 그리드 -->
    <div id="popupPhotoGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;"></div>
    <!-- 일괄 편집 액션 (선택 시 노출) -->
    <div id="popupBulkBar" style="display:none;background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:12px;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:8px;"><span id="popupSelCount">0</span>장 선택됨 — 적용 방식 선택</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button onclick="_bulkApplyAiBg()" style="flex:1;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:12px;font-weight:700;cursor:pointer;">AI 배경합성</button>
        <button onclick="_bulkApplyBA()" style="flex:1;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,#8fa4ff,#a3b4ff);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">B·A 합성</button>
        <button onclick="_bulkApplyOriginal()" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text3);font-size:12px;font-weight:700;cursor:pointer;">원본</button>
      </div>
    </div>
    <div id="popupProgress" style="display:none;text-align:center;padding:16px;font-size:13px;color:var(--text3);">처리 중... ⏳</div>
  `;
  _renderPopupPhotoGrid(slot);
}

function _renderPopupPhotoGrid(slot) {
  const grid = document.getElementById('popupPhotoGrid');
  const bulkBar = document.getElementById('popupBulkBar');
  const selCount = document.getElementById('popupSelCount');
  if (!grid) return;

  if (!slot.photos?.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;font-size:13px;color:var(--text3);">사진을 추가해주세요</div>';
    if (bulkBar) bulkBar.style.display = 'none';
    return;
  }

  if (selCount) selCount.textContent = _popupSelIds.size;
  if (bulkBar)  bulkBar.style.display = _popupSelIds.size > 0 ? 'block' : 'none';

  const modeColor = { original: 'var(--text3)', ai_bg: 'var(--accent)', ba: '#8fa4ff' };
  const modeLabel = { original: '원본', ai_bg: 'AI합성', ba: 'B·A' };

  grid.innerHTML = '';
  slot.photos.forEach((photo, idx) => {
    const sel  = _popupSelIds.has(photo.id);
    const cell = document.createElement('div');
    cell.style.cssText = `position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;border:2.5px solid ${sel ? 'var(--accent)' : 'transparent'};cursor:pointer;`;
    cell.innerHTML = `
      <img src="${photo.editedDataUrl || photo.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;">
      <div style="position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;border:2px solid #fff;background:${sel ? 'var(--accent)' : 'rgba(0,0,0,0.3)'};display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;">${sel ? '✓' : ''}</div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:3px 5px;background:rgba(0,0,0,0.55);font-size:9px;color:${modeColor[photo.mode]};font-weight:700;">${modeLabel[photo.mode] || '원본'}</div>
      <button onclick="unassignPopupPhoto('${photo.id}',event)" style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:9px;cursor:pointer;z-index:2;line-height:1;">↩</button>
    `;
    cell.addEventListener('click', e => { e.stopPropagation(); togglePopupPhotoSel(photo.id); });
    grid.appendChild(cell);
  });
}

function togglePopupPhotoSel(id) {
  _popupSelIds.has(id) ? _popupSelIds.delete(id) : _popupSelIds.add(id);
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (slot) _renderPopupPhotoGrid(slot);
}

// 팝업에서 사진 배정 취소 (미배정 풀로 복귀)
async function unassignPopupPhoto(photoId, e) {
  e?.stopPropagation();
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const sp = slot.photos.find(p => p.id === photoId);
  if (sp && !_photos.find(p => p.id === photoId)) {
    _photos.push({ id: sp.id, file: null, dataUrl: sp.dataUrl });
  }
  slot.photos = slot.photos.filter(p => p.id !== photoId);
  _popupSelIds.delete(photoId);
  try { await saveSlotToDB(slot); } catch(_e) {}
  _renderPopupPhotoGrid(slot);
  showToast('배정 취소됨 — 미배정 사진으로 돌아갔어요');
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
  _renderPopupPhotoGrid(slot);
}

// ═══════════════════════════════════════════════════════
// 일괄 편집 (선택된 사진들에 모드 적용)
// ═══════════════════════════════════════════════════════
async function _bulkApplyAiBg() {
  if (!_popupSelIds.size) { showToast('사진을 먼저 선택해주세요'); return; }
  if (!confirm(`선택한 ${_popupSelIds.size}장에 AI 배경합성을 적용할까요?\n서버 비용이 발생해요.`)) return;
  if (_popupUsage && (_popupUsage.used + _popupSelIds.size) > _popupUsage.limit) {
    showToast(`남은 횟수(${_popupUsage.limit - _popupUsage.used}회)가 부족해요`);
    return;
  }
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const progress = document.getElementById('popupProgress');
  if (progress) progress.style.display = 'block';
  for (const id of _popupSelIds) {
    const photo = slot.photos.find(p => p.id === id);
    if (photo) await _applyAiBg(photo, slot);
  }
  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _renderPopupPhotoGrid(slot);
}

async function _bulkApplyBA() {
  if (_popupSelIds.size < 2) { showToast('B·A 합성은 사진 2장 이상 선택해주세요'); return; }
  const slot    = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const selArr  = [..._popupSelIds];
  const beforeId = selArr[0];
  const afterId  = selArr[1];
  const before  = slot.photos.find(p => p.id === beforeId);
  const after   = slot.photos.find(p => p.id === afterId);
  if (!before || !after) return;
  const progress = document.getElementById('popupProgress');
  if (progress) progress.style.display = 'block';
  await _applyBABetween(before, after, slot);
  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _renderPopupPhotoGrid(slot);
}

async function _bulkApplyOriginal() {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  for (const id of _popupSelIds) {
    const photo = slot.photos.find(p => p.id === id);
    if (photo) { photo.mode = 'original'; photo.editedDataUrl = null; }
  }
  try { await saveSlotToDB(slot); } catch(_e) {}
  _popupSelIds.clear();
  _renderPopupPhotoGrid(slot);
}

// ═══════════════════════════════════════════════════════
// AI 배경합성 / BA 합성 (app-portfolio.js 공유 유틸 사용)
// ═══════════════════════════════════════════════════════
async function _applyAiBg(photo, slot) {
  try {
    const blob = _dataUrlToBlob(photo.dataUrl);
    const fd   = new FormData();
    fd.append('file', blob, 'photo.jpg');
    const res  = await fetch(API + '/image/remove-bg', { method: 'POST', headers: authHeader(), body: fd });
    if (res.status === 429) { showToast((await res.json().catch(() => ({}))).detail || '한도 초과'); return; }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'API 오류');
    const url       = URL.createObjectURL(await res.blob());
    const personImg = await _loadImageSrc(url);
    URL.revokeObjectURL(url);
    const canvas = document.createElement('canvas');
    await compositePersonOnCanvas(canvas, personImg, 1080, 1350, 'cloud_bw', null);
    photo.editedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    photo.mode = 'ai_bg';
    if (_popupUsage) _popupUsage.used++;
    await saveSlotToDB(slot);
  } catch(e) { showToast('오류: ' + e.message); }
}

async function _applyBABetween(before, after, slot) {
  try {
    const beforeImg = await _loadImageSrc(before.dataUrl);
    const afterImg  = await _loadImageSrc(after.dataUrl);
    const canvas    = document.createElement('canvas');
    renderBASplit(canvas, beforeImg, afterImg, 1080, 1080);
    before.editedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    before.mode = 'ba';
    await saveSlotToDB(slot);
  } catch(e) { showToast('오류: ' + e.message); }
}

// ═══════════════════════════════════════════════════════
// 글쓰기 탭 — 슬롯 픽커
// ═══════════════════════════════════════════════════════
function initCaptionSlotPicker() {
  const doneSlots = _slots.filter(s => s.status === 'done' && s.photos.length > 0);
  const container = document.getElementById('captionSlotPicker');
  if (!container) return;

  if (!doneSlots.length) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  container.innerHTML = `
    <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:8px;">작업실 슬롯 선택</div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">
      ${doneSlots.map(slot => {
        const thumb = slot.photos[0];
        return `
          <div onclick="loadSlotForCaption('${slot.id}')" style="flex-shrink:0;width:72px;cursor:pointer;text-align:center;">
            <img src="${thumb.editedDataUrl || thumb.dataUrl}" style="width:72px;height:72px;object-fit:cover;border-radius:10px;border:1.5px solid var(--border);">
            <div style="font-size:10px;color:var(--text2);margin-top:4px;font-weight:600;">${slot.label}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function loadSlotForCaption(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot || !slot.photos.length) return;

  // 캡션 메모에 슬롯 라벨 채우기
  const memo = document.getElementById('captionMemo');
  if (memo && !memo.value) memo.value = slot.label + ' 시술 완료';

  // Before(첫번째) / After(두번째) 사진 연결
  const first  = slot.photos[0];
  const second = slot.photos[1] || null;

  // captionPhotoSection 열기
  const section = document.getElementById('captionPhotoSection');
  if (section) section.style.display = 'block';

  if (first) _setCaptionPhoto('after', first.editedDataUrl || first.dataUrl);
  if (second) _setCaptionPhoto('before', second.editedDataUrl || second.dataUrl);

  showToast(`${slot.label} 사진 연결됐어요 ✅`);
}

function _setCaptionPhoto(side, dataUrl) {
  const preview = document.getElementById(`caption${side.charAt(0).toUpperCase() + side.slice(1)}Preview`);
  const img     = document.getElementById(`caption${side.charAt(0).toUpperCase() + side.slice(1)}Img`);
  const empty   = document.getElementById(`caption${side.charAt(0).toUpperCase() + side.slice(1)}Empty`);
  const clear   = document.getElementById(`caption${side.charAt(0).toUpperCase() + side.slice(1)}Clear`);
  if (img) img.src = dataUrl;
  if (preview) preview.style.display = 'block';
  if (empty)   empty.style.display   = 'none';
  if (clear)   clear.style.display   = 'block';
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
  const doneSlots   = _slots.filter(s => s.status === 'done' && s.photos.length > 0);
  const incompleteN = _slots.filter(s => s.status !== 'done' || !s.photos.length).length;

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

  const incompleteHtml = incompleteN > 0
    ? `<div style="font-size:11px;color:var(--text3);margin-bottom:14px;">미완료 ${incompleteN}개 있어요 · <button onclick="showTab('workshop',document.querySelectorAll('.nav-btn')[1]); initWorkshopTab();" style="background:transparent;border:none;color:var(--accent2);font-size:11px;font-weight:700;cursor:pointer;padding:0;">작업실로 →</button></div>`
    : '';

  if (!doneSlots.length) {
    root.innerHTML = `
      <div class="sec-title" style="margin-bottom:4px;">마무리 🎀</div>
      ${incompleteHtml}
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:32px;margin-bottom:10px;">⏳</div>
        <div style="font-size:13px;font-weight:700;color:var(--text);">완료된 슬롯이 없어요</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">작업실에서 슬롯을 완료(✅)하면 여기 표시돼요</div>
      </div>
    `;
    return;
  }

  const slotsHtml = doneSlots.map(slot => {
    const thumbs = slot.photos.slice(0, 2).map(p =>
      `<img src="${p.editedDataUrl || p.dataUrl}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;">`
    ).join('');
    const cap = slot.caption
      ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${slot.caption.slice(0,40)}...</div>`
      : '';
    return `
      <div style="background:#fff;border:1.5px solid rgba(76,175,80,0.3);border-radius:16px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">
          <div style="display:flex;gap:4px;">${thumbs}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:800;color:var(--text);">${slot.label} ✅</div>
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
    ${incompleteHtml}
    <div class="sec-sub" style="margin-bottom:16px;">완료 ${doneSlots.length}개 · 원하는 방법으로 마무리하세요</div>
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
    const upRes  = await fetch(API + '/portfolio', { method: 'POST', headers: authHeader(), body: fd });
    if (!upRes.ok) { showToast('업로드 실패'); return; }
    const upData = await upRes.json();
    const imgUrl = upData.image_url?.startsWith('http') ? upData.image_url : API + (upData.image_url || '');
    if (typeof doInstagramPublish === 'function') {
      await doInstagramPublish(imgUrl, fullCaption);
      slot.status = 'done';
      await saveSlotToDB(slot);
      initFinishTab();
    }
  } catch(e) { showToast('오류: ' + e.message); }
}

function writeSlotCaption(slotId) {
  showTab('caption', document.querySelectorAll('.nav-btn')[2]);
  setTimeout(() => {
    loadSlotForCaption(slotId);
    initCaptionSlotPicker();
  }, 100);
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
