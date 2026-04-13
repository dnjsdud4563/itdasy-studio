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
let _captionSlotId  = null;      // 글쓰기탭에 연결된 슬롯 ID
let _previewPhotoIdx = 0;        // 미리보기 팝업 현재 사진 인덱스

// ═══════════════════════════════════════════════════════
// 홈 탭 퀵액션
// ═══════════════════════════════════════════════════════
function goWorkshopUpload() {
  showTab('workshop', document.querySelectorAll('.nav-btn')[1]);
  initWorkshopTab();
  setTimeout(() => {
    const zone = document.getElementById('wsDropZone');
    if (zone) {
      zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
      zone.style.borderColor = 'var(--accent)';
      zone.style.background = 'rgba(241,128,145,0.06)';
      setTimeout(() => { zone.style.borderColor = ''; zone.style.background = ''; }, 1500);
    }
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
    <div style="display:flex;align-items:center;gap:8px;">
      <button id="wsResetBtn" onclick="resetWorkshop()" style="display:none;padding:5px 12px;border-radius:8px;border:1px solid rgba(220,53,69,0.3);background:transparent;color:#dc3545;font-size:11px;font-weight:700;cursor:pointer;">재시작</button>
      <div id="wsCompletionBadge" style="font-size:11px;font-weight:700;color:var(--accent2);"></div>
    </div>
  </div>
  <div class="sec-sub" style="margin-bottom:16px;">오늘 시술 사진을 올리고, 손님별로 묶어보세요</div>

  <!-- 사진 올리기 드롭존 -->
  <div id="wsDropZone" style="background:var(--bg2);border:1.5px dashed rgba(241,128,145,0.4);border-radius:18px;padding:20px;text-align:center;margin-bottom:16px;cursor:pointer;transition:border-color 0.2s,background 0.2s;"
    onclick="document.getElementById('galleryFileInput').click()"
    ondragover="event.preventDefault();this.style.borderColor='var(--accent)';this.style.background='rgba(241,128,145,0.06)';"
    ondragleave="this.style.borderColor='';this.style.background='';"
    ondrop="_handleDropZoneDrop(event)">
    <input type="file" id="galleryFileInput" accept="image/*" multiple style="display:none;" onchange="handleGalleryUpload(this)">
    <div style="font-size:28px;margin-bottom:6px;">📷</div>
    <div style="font-size:13px;font-weight:700;color:var(--text2);">탭하거나 여기로 드래그하세요</div>
    <div style="font-size:11px;color:var(--text3);margin-top:3px;">최대 20장</div>
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
  const files     = Array.isArray(input) ? input : Array.from(input.files || []);
  const remaining = 20 - _photos.length;
  const toAdd     = files.slice(0, remaining);
  for (const file of toAdd) {
    _photos.push({ id: _uid(), file, dataUrl: await _fileToDataUrl(file) });
  }
  if (files.length > remaining) showToast(`최대 20장까지 가능해요 (${remaining}장 추가됨)`);
  if (!Array.isArray(input)) input.value = '';
  const zone = document.getElementById('wsDropZone');
  if (zone) { zone.style.borderColor = ''; zone.style.background = ''; }
  _renderPhotoGrid();
  if (_slots.length === 0) {
    setTimeout(() => {
      const el = document.getElementById('slotCreateSection');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 200);
  }
}

async function _handleDropZoneDrop(e) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (!files.length) { showToast('이미지 파일만 올릴 수 있어요'); return; }
  await handleGalleryUpload(files);
}

async function resetWorkshop() {
  if (!confirm('전체 초기화할까요?\n모든 사진과 슬롯이 삭제됩니다.')) return;
  for (const slot of _slots) {
    try { await deleteSlotFromDB(slot.id); } catch(_e) {}
  }
  _photos = []; _slots = [];
  _selectedIds.clear(); _slotCheckIds.clear(); _popupSelIds.clear();
  _wsInited = false;
  const root = document.getElementById('workshopRoot');
  if (root) { root.innerHTML = _buildWorkshopHTML(); _initDragEvents(); }
  showToast('초기화 완료 ✅');
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
  // 재시작 버튼: 사진이나 슬롯이 있으면 표시
  const resetBtn = document.getElementById('wsResetBtn');
  if (resetBtn) resetBtn.style.display = (_photos.length > 0 || _slots.length > 0) ? 'block' : 'none';

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
  let html = `<button onclick="deleteSelectedPhotos()" style="padding:4px 10px;border-radius:8px;border:1px solid rgba(220,53,69,0.4);background:transparent;color:#dc3545;font-size:11px;font-weight:700;cursor:pointer;">선택 삭제(${_selectedIds.size})</button>`;
  if (open.length) {
    html += ' ' + open.map(s => `<button onclick="assignSelectedToSlot('${s.id}')" style="margin-left:4px;padding:4px 10px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;">${s.label}에 넣기</button>`).join('');
  }
  el.innerHTML = html;
}

function deleteSelectedPhotos() {
  if (!_selectedIds.size) return;
  _photos = _photos.filter(p => !_selectedIds.has(p.id));
  _selectedIds.clear();
  _renderPhotoGrid();
  showToast('선택한 사진 삭제됨');
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
    if (done > 0) {
      banner.style.display = 'block';
      const allDone = done === total;
      banner.innerHTML = `
        <div style="background:rgba(241,128,145,0.07);border:1.5px solid rgba(241,128,145,0.2);border-radius:16px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:12px;font-weight:700;color:var(--text);">${allDone ? '🎉 모든 작업 완료!' : `✅ ${done}개 완료됨`}</div>
          <button onclick="showTab('caption',document.querySelectorAll('.nav-btn')[2]); initCaptionSlotPicker();" style="padding:8px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;">완료된 작업 글쓰러 가기 →</button>
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
  // 드래그한 사진이 선택된 사진 중 하나면 → 선택된 전체 배정
  if (_selectedIds.has(_dragPhotoId) && _selectedIds.size > 1) {
    [..._selectedIds].forEach(id => _assignToSlot(id, slotId));
    _selectedIds.clear();
    showToast(`${_selectedIds.size || '여러'}장 배정 완료 ✅`);
  } else {
    _assignToSlot(_dragPhotoId, slotId);
  }
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

  const visiblePhotos = (slot.photos || []).filter(p => !p.hidden);

  if (!visiblePhotos.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;font-size:13px;color:var(--text3);">사진을 추가해주세요</div>';
    if (bulkBar) bulkBar.style.display = 'none';
    return;
  }

  if (selCount) selCount.textContent = _popupSelIds.size;
  if (bulkBar)  bulkBar.style.display = _popupSelIds.size > 0 ? 'block' : 'none';

  // 선택 순서에 따른 BEFORE/AFTER 라벨
  const selArr = [..._popupSelIds];
  const baLabelMap = {};
  if (selArr[0]) baLabelMap[selArr[0]] = 'BEFORE';
  if (selArr[1]) baLabelMap[selArr[1]] = 'AFTER';

  const modeColor = { original: 'var(--text3)', ai_bg: 'var(--accent)', ba: '#8fa4ff' };
  const modeLabel = { original: '원본', ai_bg: 'AI합성', ba: 'B·A' };

  grid.innerHTML = '';
  visiblePhotos.forEach(photo => {
    const sel   = _popupSelIds.has(photo.id);
    const baLbl = baLabelMap[photo.id];

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;';

    const imgBox = document.createElement('div');
    imgBox.style.cssText = `position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;border:2.5px solid ${sel ? 'var(--accent)' : 'transparent'};cursor:pointer;`;
    imgBox.innerHTML = `
      <img src="${photo.editedDataUrl || photo.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;">
      <div style="position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;border:2px solid #fff;background:${sel ? 'var(--accent)' : 'rgba(0,0,0,0.3)'};display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;">${sel ? '✓' : ''}</div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:3px 5px;background:rgba(0,0,0,0.55);font-size:9px;color:${modeColor[photo.mode]};font-weight:700;">${modeLabel[photo.mode] || '원본'}</div>
      ${baLbl ? `<div style="position:absolute;top:3px;left:3px;background:${baLbl==='BEFORE'?'rgba(100,149,237,0.92)':'rgba(241,128,145,0.92)'};border-radius:4px;padding:2px 6px;font-size:9px;color:#fff;font-weight:800;">${baLbl}</div>` : ''}
      <button onclick="unassignPopupPhoto('${photo.id}',event)" style="position:absolute;top:${baLbl?'22':'3'}px;left:3px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:9px;cursor:pointer;z-index:2;line-height:1;">↩</button>
    `;
    imgBox.addEventListener('click', e => { e.stopPropagation(); togglePopupPhotoSel(photo.id); });
    wrap.appendChild(imgBox);

    if (photo.mode === 'ba') {
      const restoreBtn = document.createElement('button');
      restoreBtn.textContent = '↩ 되돌리기';
      restoreBtn.style.cssText = 'width:100%;padding:3px;border-radius:6px;border:1px solid rgba(143,164,255,0.5);background:transparent;font-size:10px;color:#8fa4ff;cursor:pointer;font-weight:700;';
      restoreBtn.onclick = () => restoreBAPhoto(photo.id);
      wrap.appendChild(restoreBtn);
    }

    const previewBtn = document.createElement('button');
    previewBtn.textContent = '미리보기';
    previewBtn.style.cssText = 'width:100%;padding:3px;border-radius:6px;border:1px solid var(--border);background:transparent;font-size:10px;color:var(--text3);cursor:pointer;';
    previewBtn.onclick = () => showPhotoInstaPreview(photo.editedDataUrl || photo.dataUrl);
    wrap.appendChild(previewBtn);

    grid.appendChild(wrap);
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
  if (_popupSelIds.size < 2) {
    showToast('사진 2장 선택해주세요\n첫 번째 선택 = BEFORE, 두 번째 = AFTER');
    return;
  }
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const selArr   = [..._popupSelIds];
  const beforeId = selArr[0];
  const afterId  = selArr[1];
  const before   = slot.photos.find(p => p.id === beforeId);
  const after    = slot.photos.find(p => p.id === afterId);
  if (!before || !after) return;
  const progress = document.getElementById('popupProgress');
  if (progress) progress.style.display = 'block';
  await _applyBABetween(before, after, slot);
  // AFTER 사진 숨김 처리 + 연결 ID 저장 (되돌리기용)
  before.baAfterRefId = afterId;
  after.hidden = true;
  try { await saveSlotToDB(slot); } catch(_e) {}
  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _renderPopupPhotoGrid(slot);
  showToast('B·A 합성 완료! [되돌리기]로 원본 복원 가능해요 ✅');
}

async function restoreBAPhoto(baPhotoId) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const baPhoto = slot.photos.find(p => p.id === baPhotoId);
  if (!baPhoto) return;
  if (baPhoto.baAfterRefId) {
    const afterPhoto = slot.photos.find(p => p.id === baPhoto.baAfterRefId);
    if (afterPhoto) afterPhoto.hidden = false;
  }
  baPhoto.mode = 'original';
  baPhoto.editedDataUrl = null;
  baPhoto.baAfterRefId = null;
  try { await saveSlotToDB(slot); } catch(_e) {}
  _renderPopupPhotoGrid(slot);
  showToast('원본 2장으로 복원됐어요');
}

function showPhotoInstaPreview(dataUrl) {
  let pop = document.getElementById('_wsInstaPreviewPop');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = '_wsInstaPreviewPop';
    pop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10000;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:20px;box-sizing:border-box;';
    pop.innerHTML = `
      <div style="width:100%;max-width:380px;">
        <div style="background:#fff;border-radius:14px;overflow:hidden;">
          <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #f0f0f0;">
            <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800;">잇</div>
            <div style="font-size:13px;font-weight:700;">@itdasy</div>
          </div>
          <img id="_wsPreviewImg" style="width:100%;aspect-ratio:1/1;object-fit:cover;display:block;">
          <div style="padding:8px 12px;font-size:11px;color:#888;">인스타 피드 1:1 비율 미리보기</div>
        </div>
      </div>
      <button onclick="document.getElementById('_wsInstaPreviewPop').style.display='none'" style="margin-top:16px;color:#fff;background:transparent;border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:8px 20px;font-size:13px;cursor:pointer;">닫기</button>
    `;
    document.body.appendChild(pop);
  }
  document.getElementById('_wsPreviewImg').src = dataUrl;
  pop.style.display = 'flex';
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
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:12px 14px;">
      <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:10px;">작업실 슬롯 <span style="font-size:10px;color:var(--text3);font-weight:400;">— 탭하면 사진이 연결돼요</span></div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;" id="captionSlotCards">
        ${doneSlots.map(slot => {
          const thumb = slot.photos.filter(p => !p.hidden)[0];
          if (!thumb) return '';
          return `
            <div id="csPick_${slot.id}" onclick="loadSlotForCaption('${slot.id}')" style="flex-shrink:0;width:64px;cursor:pointer;text-align:center;">
              <img src="${thumb.editedDataUrl || thumb.dataUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:2px solid transparent;transition:border-color 0.2s;" id="csThumb_${slot.id}">
              <div style="font-size:9px;color:var(--text2);margin-top:3px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${slot.label}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div id="captionSlotPhotoStrip" style="display:none;margin-top:10px;"></div>
    </div>
  `;
}

async function loadSlotForCaption(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot) return;
  _captionSlotId = slotId;

  // 슬롯 카드 선택 표시
  document.querySelectorAll('[id^="csThumb_"]').forEach(el => {
    el.style.borderColor = 'transparent';
  });
  const pickedThumb = document.getElementById(`csThumb_${slotId}`);
  if (pickedThumb) pickedThumb.style.borderColor = 'var(--accent)';

  // 보이는 사진만 (hidden 제외)
  const visPhotos = slot.photos.filter(p => !p.hidden);

  // 사진 스와이프 스트립 표시
  const strip = document.getElementById('captionSlotPhotoStrip');
  if (strip && visPhotos.length > 0) {
    const total = visPhotos.length;
    strip.style.display = 'block';
    strip.innerHTML = `
      <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;aspect-ratio:1/1;">
        <div id="csPhotoSwipe" style="display:flex;width:${total * 100}%;height:100%;transition:transform 0.3s;">
          ${visPhotos.map(p => `
            <div style="width:${100/total}%;height:100%;flex-shrink:0;">
              <img src="${p.editedDataUrl || p.dataUrl}" style="width:100%;height:100%;object-fit:cover;">
            </div>
          `).join('')}
        </div>
        ${total > 1 ? `
          <button onclick="_csSwipe(-1)" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:16px;cursor:pointer;line-height:1;">‹</button>
          <button onclick="_csSwipe(1)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:16px;cursor:pointer;line-height:1;">›</button>
        ` : ''}
      </div>
      ${total > 1 ? `<div id="csPhotoIndicator" style="text-align:center;font-size:11px;color:var(--text3);margin-top:6px;">1 / ${total}</div>` : ''}
    `;
    window._csSwipeIdx = 0;
    window._csTotalPhotos = total;
  } else if (strip) {
    strip.style.display = 'none';
  }

  showToast(`${slot.label} 연결됐어요 ✅`);
}

function _csSwipe(dir) {
  const total = window._csTotalPhotos || 1;
  window._csSwipeIdx = Math.max(0, Math.min(total - 1, (window._csSwipeIdx || 0) + dir));
  const swipe = document.getElementById('csPhotoSwipe');
  const indicator = document.getElementById('csPhotoIndicator');
  if (swipe) swipe.style.transform = `translateX(-${window._csSwipeIdx * (100 / total)}%)`;
  if (indicator) indicator.textContent = `${window._csSwipeIdx + 1} / ${total}`;
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
// 글쓰기 탭 — 바로 올리기 (인스타 피드 미리보기 팝업)
// ═══════════════════════════════════════════════════════
function publishFromCaption() {
  const caption = (document.getElementById('captionText')?.value || '').trim();
  const hash    = (document.getElementById('captionHash')?.value  || '').trim();
  const full    = caption + (hash ? '\n\n' + hash : '');

  const slot   = _captionSlotId ? _slots.find(s => s.id === _captionSlotId) : null;
  const photos = slot ? slot.photos.filter(p => !p.hidden) : [];

  _showCaptionPublishPreview(photos, full);
}

function _showCaptionPublishPreview(photos, caption) {
  _previewPhotoIdx = 0;
  let pop = document.getElementById('_captionPubPreviewPop');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = '_captionPubPreviewPop';
    pop.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center;';
    pop.onclick = e => { if (e.target === pop) pop.style.display = 'none'; };
    document.body.appendChild(pop);
  }

  const shopName = localStorage.getItem('shop_name') || '잇데이 스튜디오';
  const total    = photos.length;

  const photoHtml = total
    ? `<div style="position:relative;width:100%;aspect-ratio:1/1;background:#000;overflow:hidden;">
        <div id="_pubPhotoSwipe" style="display:flex;width:${total * 100}%;height:100%;transition:transform 0.3s;">
          ${photos.map(p => `<div style="width:${100/total}%;height:100%;flex-shrink:0;"><img src="${p.editedDataUrl || p.dataUrl}" style="width:100%;height:100%;object-fit:cover;"></div>`).join('')}
        </div>
        ${total > 1 ? `
          <div id="_pubIndicator" style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.5);border-radius:20px;padding:3px 8px;font-size:10px;color:#fff;">1 / ${total}</div>
          <button onclick="_pubSwipe(-1)" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;">‹</button>
          <button onclick="_pubSwipe(1)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;">›</button>
        ` : ''}
      </div>`
    : `<div style="width:100%;aspect-ratio:1/1;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:50px;">📷</div>`;

  const escapedCaption = caption.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  pop.innerHTML = `
    <div style="width:100%;max-width:500px;background:#fff;border-radius:20px 20px 0 0;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #f0f0f0;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800;">잇</div>
          <div>
            <div style="font-size:13px;font-weight:700;">${shopName}</div>
            <div style="font-size:10px;color:#999;">방금 · 게시물 미리보기</div>
          </div>
        </div>
        <button onclick="document.getElementById('_captionPubPreviewPop').style.display='none'" style="background:transparent;border:none;font-size:22px;color:#aaa;cursor:pointer;">×</button>
      </div>
      ${photoHtml}
      <div style="display:flex;align-items:center;gap:14px;padding:10px 14px 4px;">
        <span style="font-size:20px;">🤍</span><span style="font-size:20px;">💬</span><span style="font-size:20px;">📤</span>
        <span style="font-size:20px;margin-left:auto;">🔖</span>
      </div>
      <div style="padding:4px 14px 14px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${shopName}</div>
        <div style="font-size:13px;color:#262626;white-space:pre-wrap;line-height:1.65;">${escapedCaption || '(캡션 없음)'}</div>
      </div>
      <div style="padding:0 14px 28px;">
        <button onclick="doPublishFromCaption()" style="width:100%;height:48px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:14px;font-weight:800;cursor:pointer;">인스타에 올리기 🚀</button>
      </div>
    </div>
  `;
  pop.style.display = 'flex';
  window._pubPhotos     = photos;
  window._pubPhotoTotal = total;
}

function _pubSwipe(dir) {
  const total = window._pubPhotoTotal || 1;
  _previewPhotoIdx = Math.max(0, Math.min(total - 1, _previewPhotoIdx + dir));
  const swipe = document.getElementById('_pubPhotoSwipe');
  const ind   = document.getElementById('_pubIndicator');
  if (swipe) swipe.style.transform = `translateX(-${_previewPhotoIdx * (100 / total)}%)`;
  if (ind)   ind.textContent = `${_previewPhotoIdx + 1} / ${total}`;
}

async function doPublishFromCaption() {
  const caption = (document.getElementById('captionText')?.value || '').trim();
  const hash    = (document.getElementById('captionHash')?.value  || '').trim();
  const full    = caption + (hash ? '\n\n' + hash : '');
  const photos  = window._pubPhotos || [];

  if (!photos.length) { showToast('연결된 사진이 없어요. 작업실 슬롯을 먼저 선택해주세요.'); return; }

  const pop = document.getElementById('_captionPubPreviewPop');
  if (pop) pop.style.display = 'none';

  const photo = photos[_previewPhotoIdx] || photos[0];
  const upPopup = document.getElementById('uploadProgressPopup');
  if (upPopup) upPopup.style.display = 'flex';
  if (typeof setUploadProgress === 'function') setUploadProgress(10, '이미지 준비 중...');

  try {
    const blob = _dataUrlToBlob(photo.editedDataUrl || photo.dataUrl);
    const fd   = new FormData();
    fd.append('image', blob, 'photo.jpg');
    fd.append('caption', full);
    if (typeof setUploadProgress === 'function') setUploadProgress(30, '서버 전송 중...');

    const res  = await fetch(API + '/instagram/publish', {
      method: 'POST',
      headers: { ...authHeader(), 'ngrok-skip-browser-warning': 'true' },
      body: fd,
    });
    if (typeof setUploadProgress === 'function') setUploadProgress(80, '발행 중...');
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || '업로드 실패');

    if (typeof setUploadProgress === 'function') setUploadProgress(100, '완료! 🎉');
    setTimeout(() => {
      if (upPopup) upPopup.style.display = 'none';
      const donePopup = document.getElementById('uploadDonePopup');
      if (donePopup) donePopup.style.display = 'flex';
      const doneMsg = document.getElementById('uploadDoneMsg');
      if (doneMsg) doneMsg.textContent = '인스타 피드에 올라갔어요 ✨';
      if (typeof createConfetti === 'function') for (let i = 0; i < 20; i++) setTimeout(createConfetti, i * 100);
    }, 1200);
  } catch(e) {
    if (upPopup) upPopup.style.display = 'none';
    showToast('오류: ' + e.message);
  }
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
