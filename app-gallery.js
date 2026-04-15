// Itdasy Studio - 작업실 & 마무리 (갤러리, 슬롯, IndexedDB)
// 캔버스 합성은 app-portfolio.js의 공유 유틸 사용:
//   compositePersonOnCanvas(), renderBASplit(), _loadImageSrc(), _drawCoverCtx(), getCloudBg()

// ═══════════════════════════════════════════════════════
// IndexedDB
// ═══════════════════════════════════════════════════════
const _GDB_NAME = 'itdasy-gallery';
const _GDB_STORE = 'slots';
let _gdb = null;

const _GALLERY_STORE = 'gallery';

function openGalleryDB() {
  return new Promise((resolve, reject) => {
    if (_gdb) return resolve(_gdb);
    const req = indexedDB.open(_GDB_NAME, 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_GDB_STORE)) {
        const store = db.createObjectStore(_GDB_STORE, { keyPath: 'id' });
        store.createIndex('order', 'order', { unique: false });
      }
      if (!db.objectStoreNames.contains(_GALLERY_STORE)) {
        const gs = db.createObjectStore(_GALLERY_STORE, { keyPath: 'id' });
        gs.createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess = e => { _gdb = e.target.result; resolve(_gdb); };
    req.onerror  = () => reject(req.error);
  });
}

async function saveToGallery(slot) {
  const db = await openGalleryDB();
  const item = {
    id: _uid(),
    slotId: slot.id,
    date: new Date().toISOString().slice(0, 10),
    label: slot.label,
    photos: slot.photos.map(p => ({ id: p.id, dataUrl: p.editedDataUrl || p.dataUrl, mode: p.mode })),
    caption: slot.caption || '',
    hashtags: slot.hashtags || '',
    savedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_GALLERY_STORE, 'readwrite');
    tx.objectStore(_GALLERY_STORE).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

async function loadGalleryItems() {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(_GALLERY_STORE, 'readonly');
    const req = tx.objectStore(_GALLERY_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.savedAt - a.savedAt));
    req.onerror   = () => reject(req.error);
  });
}

async function deleteGalleryItem(id) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_GALLERY_STORE, 'readwrite');
    tx.objectStore(_GALLERY_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
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
let _popupSelIds    = new Set(); // 팝업 내 사진 선택 (일괄 편집용)
let _wsInited       = false;
let _dragPhotoId    = null;
let _dragSrcEl      = null;
let _popupSlotId    = null;
let _popupUsage     = null;
let _captionSlotId  = null;      // 글쓰기탭에 연결된 슬롯 ID
let _previewPhotoIdx = 0;        // 미리보기 팝업 현재 사진 인덱스
let _baMode         = false;     // 비포/애프터 모드 활성화 여부

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
  <div class="sec-sub" style="margin-bottom:16px;">오늘 시술 결과를 인스타용으로 꾸며요</div>

  <!-- 사진 올리기 (메인 CTA) -->
  <div id="wsDropZone" style="background:var(--bg2);border:1.5px dashed rgba(241,128,145,0.4);border-radius:18px;padding:24px;text-align:center;margin-bottom:16px;cursor:pointer;transition:border-color 0.2s,background 0.2s;"
    onclick="document.getElementById('galleryFileInput').click()"
    ondragover="event.preventDefault();this.style.borderColor='var(--accent)';this.style.background='rgba(241,128,145,0.06)';"
    ondragleave="this.style.borderColor='';this.style.background='';"
    ondrop="_handleDropZoneDrop(event)"
    oncontextmenu="return false">
    <input type="file" id="galleryFileInput" accept="image/*" multiple style="display:none;" onchange="handleGalleryUpload(this)">
    <div style="font-size:36px;margin-bottom:8px;">📷</div>
    <div style="font-size:14px;font-weight:700;color:var(--text);">시술 사진 올려서 작업 시작</div>
    <div style="font-size:12px;color:var(--text3);margin-top:4px;">탭해서 사진 선택 · 최대 20장</div>
  </div>

  <!-- 슬롯 카드 (가로 스크롤) -->
  <div id="slotCardHeader" style="display:none;margin-bottom:12px;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:13px;font-weight:800;color:var(--text);">👤 손님별 사진</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span id="wsCompletionCount" style="font-size:11px;color:var(--text3);"></span>
        <button onclick="openAssignPopup()" style="padding:6px 12px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-size:11px;font-weight:700;cursor:pointer;">+ 배정하기</button>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px;">💡 카드를 탭하면 배경/텍스트 편집할 수 있어요</div>
  </div>
  <div id="slotCardList" style="display:flex;gap:12px;overflow-x:auto;padding:4px 0 12px;-webkit-overflow-scrolling:touch;"></div>
  <div id="wsBanner" style="display:none;margin-bottom:8px;"></div>
  `;
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

  // 슬롯 없으면 자동 생성 (손님 1)
  if (_slots.length === 0 && toAdd.length > 0) {
    const slot = { id: _uid(), label: '손님 1', order: 0, photos: [], caption: '', hashtags: '', status: 'open', instagramPublished: false, deferredAt: null, createdAt: Date.now() };
    _slots.push(slot);
    try { await saveSlotToDB(slot); } catch(_e) {}
  }

  _renderPhotoGrid();
  _renderSlotCards();

  // 사진 추가했으면 배정 팝업 바로 열기
  if (toAdd.length > 0) {
    setTimeout(() => openAssignPopup(), 100);
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
  _selectedIds.clear(); _popupSelIds.clear();
  _wsInited = false;
  const root = document.getElementById('workshopRoot');
  if (root) { root.innerHTML = _buildWorkshopHTML(); _initDragEvents(); }
  showToast('초기화 완료 ✅');
}

// ═══════════════════════════════════════════════════════
// UI 상태 업데이트
// ═══════════════════════════════════════════════════════
function _renderPhotoGrid() {
  // 재시작 버튼: 사진이나 슬롯이 있으면 표시
  const resetBtn = document.getElementById('wsResetBtn');
  if (resetBtn) resetBtn.style.display = (_photos.length > 0 || _slots.length > 0) ? 'block' : 'none';

  // 배정 팝업이 열려있으면 갱신
  const pop = document.getElementById('_assignPopup');
  if (pop && pop.style.display === 'flex') {
    _renderAssignPopup();
  }
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
  _updateAssignBottomSheet();
}

// ═══════════════════════════════════════════════════════
// 통합 배정 팝업 (사진 + 슬롯 한 화면에서)
// ═══════════════════════════════════════════════════════
function openAssignPopup() {
  _selectedIds.clear();
  let pop = document.getElementById('_assignPopup');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = '_assignPopup';
    pop.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;';
    pop.onclick = e => { if (e.target === pop) closeAssignPopup(); };
    document.body.appendChild(pop);
  }
  _renderAssignPopup();
  pop.style.display = 'flex';
}

function closeAssignPopup() {
  const pop = document.getElementById('_assignPopup');
  if (pop) pop.style.display = 'none';
  _selectedIds.clear();
  _renderSlotCards();
  _renderPhotoGrid();
}

function _renderAssignPopup() {
  const pop = document.getElementById('_assignPopup');
  if (!pop) return;

  const unassigned = _photos.filter(p => !_isAssigned(p.id));

  // 미배정 사진 없고 모든 슬롯에 사진 있으면 완료
  if (unassigned.length === 0 && _slots.length > 0 && _slots.every(s => s.photos.length > 0)) {
    closeAssignPopup();
    showToast('배정 완료! 슬롯 카드를 탭해서 편집하세요 ✨');
    return;
  }

  // 슬롯별 썸네일 (가로 스크롤로 보여주기)
  const slotsHtml = _slots.map(slot => {
    const photos = (slot.photos || []).filter(p => !p.hidden);
    // 슬롯 내 사진들을 가로로 나열
    const photosPreview = photos.length > 0
      ? photos.slice(0, 4).map(p => `<img src="${p.editedDataUrl || p.dataUrl}" style="width:32px;height:32px;object-fit:cover;border-radius:6px;flex-shrink:0;">`).join('') + (photos.length > 4 ? `<div style="width:32px;height:32px;border-radius:6px;background:rgba(0,0,0,0.5);color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">+${photos.length-4}</div>` : '')
      : '<div style="font-size:11px;color:var(--text3);">비어있음</div>';

    return `<div data-slot-drop="${slot.id}" onclick="${_selectedIds.size > 0 ? `_assignToSlotFromPopup('${slot.id}')` : ''}" style="flex-shrink:0;width:140px;background:#fff;border:2px solid ${_selectedIds.size > 0 ? 'var(--accent)' : 'var(--border)'};border-radius:14px;padding:10px;position:relative;${_selectedIds.size > 0 ? 'cursor:pointer;' : ''}">
      <button onclick="_deleteSlotInPopup('${slot.id}');event.stopPropagation();" style="position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.08);border:none;color:#999;font-size:10px;cursor:pointer;z-index:2;">✕</button>
      <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:6px;">${slot.label}</div>
      <div style="display:flex;gap:4px;overflow-x:auto;min-height:32px;align-items:center;">${photosPreview}</div>
      ${_selectedIds.size > 0 ? `<div style="margin-top:8px;padding:6px;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:11px;font-weight:700;text-align:center;">여기에 넣기</div>` : ''}
    </div>`;
  }).join('');

  pop.innerHTML = `
    <div style="width:100%;max-width:480px;background:#fff;border-radius:24px 24px 0 0;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;" oncontextmenu="return false">
      <!-- 헤더 -->
      <div style="display:flex;justify-content:center;padding:10px 0 4px;">
        <div style="width:40px;height:4px;border-radius:2px;background:rgba(0,0,0,0.12);"></div>
      </div>
      <div style="padding:8px 16px 12px;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:16px;font-weight:800;color:var(--text);">📷 사진 → 손님 배정</div>
          <button onclick="closeAssignPopup()" style="background:transparent;border:none;font-size:24px;color:#aaa;cursor:pointer;padding:0 4px;">×</button>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">사진 선택 후 아래 손님 카드를 탭하세요</div>
      </div>

      <!-- 미배정 사진 (가로 스와이프) -->
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);background:#fafafa;">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;">📸 미배정 ${unassigned.length}장</div>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <div style="display:flex;gap:8px;min-width:max-content;padding:2px;">
            ${unassigned.length ? unassigned.map(photo => {
              const sel = _selectedIds.has(photo.id);
              return `<div onclick="togglePhotoSelect('${photo.id}');_renderAssignPopup();" style="flex-shrink:0;width:64px;cursor:pointer;">
                <div style="position:relative;width:64px;height:64px;border-radius:10px;overflow:hidden;border:3px solid ${sel ? 'var(--accent)' : 'transparent'};box-shadow:${sel ? '0 2px 8px rgba(241,128,145,0.4)' : 'none'};">
                  <img src="${photo.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;">
                  <div style="position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:2px solid #fff;background:${sel ? 'var(--accent)' : 'rgba(0,0,0,0.3)'};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;">${sel ? '✓' : ''}</div>
                </div>
              </div>`;
            }).join('') : '<div style="padding:16px;text-align:center;color:var(--accent2);font-size:12px;font-weight:600;">모든 사진 배정 완료 ✅</div>'}
          </div>
        </div>
      </div>

      <!-- 손님 슬롯 (가로 스와이프) -->
      <div style="flex:1;padding:12px 16px;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;color:var(--text3);">👤 손님 슬롯 ${_slots.length}개</div>
          <button onclick="_addSlotInPopup()" style="padding:5px 10px;border-radius:6px;border:1.5px solid var(--accent);background:transparent;color:var(--accent);font-size:10px;font-weight:700;cursor:pointer;">+ 추가</button>
        </div>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:8px;">
          <div style="display:flex;gap:10px;min-width:max-content;">
            ${slotsHtml || '<div style="padding:20px;color:var(--text3);font-size:12px;">슬롯이 없어요. + 추가를 눌러주세요</div>'}
          </div>
        </div>
      </div>

      <!-- 하단: 선택 삭제 -->
      ${_selectedIds.size > 0 ? `
        <div style="padding:10px 16px;border-top:1px solid var(--border);background:#fff;display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:12px;font-weight:700;color:var(--accent);">${_selectedIds.size}장 선택됨</div>
          <button onclick="_deleteSelectedInPopup()" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(220,53,69,0.4);background:transparent;color:#dc3545;font-size:11px;font-weight:600;cursor:pointer;">삭제</button>
        </div>
      ` : ''}
    </div>
  `;
}

async function _addSlotInPopup() {
  // 번호 재정렬 후 다음 번호 사용
  await _renumberSlots();
  const num = _slots.length + 1;
  const slot = { id: _uid(), label: `손님 ${num}`, order: num - 1, photos: [], caption: '', hashtags: '', status: 'open', instagramPublished: false, deferredAt: null, createdAt: Date.now() };
  _slots.push(slot);
  try { await saveSlotToDB(slot); } catch(_e) {}
  _renderAssignPopup();
}

async function _deleteSlotInPopup(slotId) {
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
  try { await deleteSlotFromDB(slotId); } catch(_e) {}
  // 슬롯 번호 재정렬
  _renumberSlots();
  _renderAssignPopup();
}

function _assignToSlotFromPopup(slotId) {
  if (!_selectedIds.size) return;
  [..._selectedIds].forEach(id => _assignToSlot(id, slotId));
  _selectedIds.clear();
  showToast('배정 완료 ✅');
  _renderAssignPopup();
}

function _deleteSelectedInPopup() {
  if (!_selectedIds.size) return;
  _photos = _photos.filter(p => !_selectedIds.has(p.id));
  _selectedIds.clear();
  showToast('삭제됨');
  _renderAssignPopup();
}

// 슬롯 번호 재정렬 (삭제 후)
async function _renumberSlots() {
  _slots.forEach((slot, i) => {
    slot.label = `손님 ${i + 1}`;
    slot.order = i;
  });
  for (const slot of _slots) {
    try { await saveSlotToDB(slot); } catch(_e) {}
  }
}

// 기존 함수들 호환용
function openAssignBottomSheet() { openAssignPopup(); }
function closeAssignBottomSheet() { closeAssignPopup(); }
function _updateAssignBottomSheet() { _renderAssignPopup(); }
function assignSelectedFromSheet(slotId) { _assignToSlotFromPopup(slotId); }
function deleteSelectedFromSheet() { _deleteSelectedInPopup(); }

async function _createSlots(n) {
  await _renumberSlots(); // 먼저 기존 슬롯 번호 정렬
  for (let i = 0; i < n; i++) {
    const num = _slots.length + 1;
    const slot = { id: _uid(), label: `손님 ${num}`, order: num - 1, photos: [], caption: '', hashtags: '', status: 'open', instagramPublished: false, deferredAt: null, createdAt: Date.now() };
    _slots.push(slot);
    try { await saveSlotToDB(slot); } catch(_e) {}
  }
  _renderSlotCards();
  _renderPhotoGrid();
}

// ═══════════════════════════════════════════════════════
// 슬롯 카드 (가로 스크롤)
// ═══════════════════════════════════════════════════════
function _renderSlotCards() {
  const list   = document.getElementById('slotCardList');
  const header = document.getElementById('slotCardHeader');
  const completionEl = document.getElementById('wsCompletionCount');
  if (!list) return;

  if (!_slots.length) {
    list.innerHTML = '';
    if (header) header.style.display = 'none';
    return;
  }

  if (header) header.style.display = 'block';
  const doneCount = _slots.filter(s => s.status === 'done').length;
  if (completionEl) completionEl.textContent = doneCount > 0 ? `${doneCount}/${_slots.length} 완료` : '';

  list.innerHTML = '';
  _slots.forEach(slot => {
    const done = slot.status === 'done';
    const visiblePhotos = (slot.photos || []).filter(p => !p.hidden);
    const thumb = visiblePhotos[0];
    const photoCount = visiblePhotos.length;

    const card = document.createElement('div');
    card.style.cssText = `flex-shrink:0;width:140px;background:#fff;border:2px solid ${done ? 'rgba(76,175,80,0.5)' : 'var(--border)'};border-radius:14px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;`;
    card.dataset.slotId = slot.id;
    card.setAttribute('oncontextmenu', 'return false');

    const thumbHtml = thumb
      ? `<div onclick="openSlotPopup('${slot.id}')" style="position:relative;width:100%;aspect-ratio:1/1;border-radius:10px;overflow:hidden;cursor:pointer;">
          <img src="${thumb.editedDataUrl || thumb.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;">
          ${photoCount > 1 ? `<div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.6);border-radius:6px;padding:2px 6px;font-size:9px;color:#fff;font-weight:700;">+${photoCount}</div>` : ''}
        </div>`
      : `<div onclick="openAssignPopup()" style="width:100%;aspect-ratio:1/1;border-radius:10px;border:2px dashed rgba(241,128,145,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(241,128,145,0.03);font-size:20px;color:var(--text3);">+</div>`;

    card.innerHTML = `
      <button onclick="deleteSlot('${slot.id}',event)" style="position:absolute;top:6px;right:6px;z-index:2;background:rgba(255,255,255,0.9);border:none;font-size:12px;color:var(--text3);cursor:pointer;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;">✕</button>
      ${thumbHtml}
      <div style="margin-top:6px;text-align:center;">
        <div style="font-size:11px;font-weight:800;color:var(--text);">${slot.label}${done ? ' ✅' : ''}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;">${photoCount}장</div>
      </div>
    `;
    list.appendChild(card);
  });

  // 재시작 버튼
  const resetBtn = document.getElementById('wsResetBtn');
  if (resetBtn) resetBtn.style.display = _slots.length > 0 ? 'block' : 'none';
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
  try { await deleteSlotFromDB(slotId); } catch(_e) {}
  // 슬롯 번호 재정렬
  await _renumberSlots();
  _renderSlotCards();
  _renderPhotoGrid();
  _renderCompletionBanner();
}

// ═══════════════════════════════════════════════════════
// 완료 현황 배너 + 다음 손님 유도
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
      // 다음 미완료 슬롯 찾기 (사진이 있는 것 우선)
      const nextSlot = _slots.find(s => s.status !== 'done' && s.photos.length > 0)
                    || _slots.find(s => s.status !== 'done');

      if (allDone) {
        // 모든 작업 완료
        banner.innerHTML = `
          <div style="background:rgba(76,175,80,0.1);border:1.5px solid rgba(76,175,80,0.3);border-radius:16px;padding:14px 16px;">
            <div style="font-size:13px;font-weight:700;color:#388e3c;margin-bottom:10px;">🎉 모든 작업 완료!</div>
            <button onclick="showTab('caption',document.querySelectorAll('.nav-btn')[2]); initCaptionSlotPicker(); if(typeof renderCaptionKeywordTags==='function')renderCaptionKeywordTags();" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:13px;font-weight:800;cursor:pointer;">지금 글쓰기로 →</button>
          </div>
        `;
      } else {
        // 일부 완료 + 다음 손님 유도
        const nextLabel = nextSlot ? nextSlot.label : '다음 손님';
        banner.innerHTML = `
          <div style="background:rgba(241,128,145,0.07);border:1.5px solid rgba(241,128,145,0.2);border-radius:16px;padding:14px 16px;">
            <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px;">${nextLabel} 작업할까요? <span style="color:var(--text3);font-weight:400;">(완료 ${done}/${total})</span></div>
            <div style="display:flex;gap:8px;">
              ${nextSlot ? `<button onclick="openSlotPopup('${nextSlot.id}')" style="flex:1;padding:10px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:12px;font-weight:700;cursor:pointer;">${nextLabel} →</button>` : ''}
              <button onclick="showTab('caption',document.querySelectorAll('.nav-btn')[2]); initCaptionSlotPicker(); if(typeof renderCaptionKeywordTags==='function')renderCaptionKeywordTags();" style="flex:1;padding:10px 14px;border-radius:10px;border:1.5px solid var(--accent);background:transparent;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;">지금 글쓰기로 →</button>
            </div>
          </div>
        `;
      }
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

  // 완료 후 다음 손님 유도 토스트
  const done = _slots.filter(s => s.status === 'done').length;
  const total = _slots.length;
  const nextSlot = _slots.find(s => s.status !== 'done' && s.photos.length > 0);

  if (nextSlot) {
    _showNextSlotGuide(nextSlot, done, total);
  } else if (done === total) {
    showToast('🎉 모든 작업 완료! 글쓰기로 이동하세요');
  }
}

// 다음 손님 유도 바텀시트
function _showNextSlotGuide(nextSlot, doneCount, totalCount) {
  let pop = document.getElementById('_nextSlotGuide');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = '_nextSlotGuide';
    pop.style.cssText = 'position:fixed;inset:0;z-index:9400;background:rgba(0,0,0,0.4);display:flex;align-items:flex-end;justify-content:center;';
    pop.onclick = e => { if (e.target === pop) pop.style.display = 'none'; };
    document.body.appendChild(pop);
  }
  pop.innerHTML = `
    <div style="width:100%;max-width:480px;background:#fff;border-radius:20px 20px 0 0;padding:20px 16px 28px;">
      <div style="display:flex;justify-content:center;padding:0 0 12px;">
        <div style="width:36px;height:4px;border-radius:2px;background:rgba(0,0,0,0.12);"></div>
      </div>
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:32px;margin-bottom:8px;">✅</div>
        <div style="font-size:15px;font-weight:800;color:var(--text);">${nextSlot.label.replace('손님','손님 ')}도 작업할까요?</div>
        <div style="font-size:12px;color:var(--text3);margin-top:4px;">완료 ${doneCount}/${totalCount}</div>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('_nextSlotGuide').style.display='none';openSlotPopup('${nextSlot.id}')" style="flex:1;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:14px;font-weight:800;cursor:pointer;">${nextSlot.label} →</button>
        <button onclick="document.getElementById('_nextSlotGuide').style.display='none';showTab('caption',document.querySelectorAll('.nav-btn')[2]);initCaptionSlotPicker();if(typeof renderCaptionKeywordTags==='function')renderCaptionKeywordTags();" style="flex:1;padding:14px;border-radius:14px;border:1.5px solid var(--accent);background:transparent;color:var(--accent);font-size:14px;font-weight:700;cursor:pointer;">지금 글쓰기로 →</button>
      </div>
    </div>
  `;
  pop.style.display = 'flex';
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
    <!-- 선택 삭제 (선택 시 노출) -->
    <div id="popupBulkBar" style="display:none;background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:12px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:12px;font-weight:700;color:var(--text);"><span id="popupSelCount">0</span>장 선택됨</div>
        <button onclick="_bulkDeletePopup()" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(220,53,69,0.4);background:transparent;color:#dc3545;font-size:11px;font-weight:700;cursor:pointer;">선택 삭제</button>
      </div>
    </div>
    <div id="popupProgress" style="display:none;text-align:center;padding:16px;font-size:13px;color:var(--text3);">처리 중... ⏳</div>
    <!-- 안내 문구 -->
    <div style="text-align:center;padding:8px;font-size:11px;color:var(--text3);background:rgba(241,128,145,0.06);border-radius:10px;">
      💡 배경 편집은 하단 <b>배경</b> 탭에서 할 수 있어요
    </div>
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

  // 선택 순서에 따른 BEFORE/AFTER 라벨 (비포/애프터 모드일 때만)
  const selArr = [..._popupSelIds];
  const baLabelMap = {};
  if (_baMode) {
    if (selArr[0]) baLabelMap[selArr[0]] = 'BEFORE';
    if (selArr[1]) baLabelMap[selArr[1]] = 'AFTER';
  }

  const modeColor = { original: 'var(--text3)', ai_bg: 'var(--accent)', ba: '#8fa4ff' };
  const modeLabel = { original: '원본', ai_bg: 'AI합성', ba: '비포/애프터' };

  grid.innerHTML = '';
  visiblePhotos.forEach(photo => {
    const sel   = _popupSelIds.has(photo.id);
    const baLbl = baLabelMap[photo.id];

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;user-select:none;-webkit-user-select:none;';
    wrap.setAttribute('oncontextmenu', 'return false');

    const imgBox = document.createElement('div');
    imgBox.style.cssText = `position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;border:2.5px solid ${sel ? 'var(--accent)' : 'transparent'};cursor:pointer;user-select:none;-webkit-user-select:none;`;
    imgBox.innerHTML = `
      <img src="${photo.editedDataUrl || photo.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;">
      <div style="position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;border:2px solid #fff;background:${sel ? 'var(--accent)' : 'rgba(0,0,0,0.3)'};display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;">${sel ? '✓' : ''}</div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:3px 5px;background:rgba(0,0,0,0.55);font-size:9px;color:${modeColor[photo.mode]};font-weight:700;">${modeLabel[photo.mode] || '원본'}</div>
      ${baLbl ? `<div style="position:absolute;top:3px;left:3px;background:${baLbl==='BEFORE'?'rgba(100,149,237,0.92)':'rgba(241,128,145,0.92)'};border-radius:4px;padding:2px 6px;font-size:9px;color:#fff;font-weight:800;">${baLbl}</div>` : ''}
      <button onclick="unassignPopupPhoto('${photo.id}',event)" style="position:absolute;top:${baLbl?'22':'3'}px;left:3px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:9px;cursor:pointer;z-index:2;line-height:1;">↩</button>
    `;
    imgBox.addEventListener('click', e => { e.stopPropagation(); togglePopupPhotoSel(photo.id); });
    // 텍스트 선택 방지
    imgBox.addEventListener('touchstart', e => { e.preventDefault(); }, { passive: false });
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
  // 비포/애프터 모드에서 2장 선택시 자동 적용
  if (_baMode && _popupSelIds.size >= 2) {
    setTimeout(() => _checkAndApplyBA(), 100);
  }
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

// 비포/애프터 모드 토글
function toggleBAMode() {
  _baMode = !_baMode;
  const btn = document.getElementById('baBtnToolbar');
  if (btn) {
    btn.style.background = _baMode ? 'linear-gradient(135deg,#8fa4ff,#a3b4ff)' : '#fff';
    btn.style.color = _baMode ? '#fff' : 'var(--text)';
    btn.style.borderColor = _baMode ? '#8fa4ff' : 'var(--border)';
  }
  if (_baMode) {
    _popupSelIds.clear();
    showToast('비포/애프터 모드 ON\n사진 2장을 순서대로 선택하세요');
  } else {
    showToast('비포/애프터 모드 OFF');
  }
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (slot) _renderPopupPhotoGrid(slot);
}

// 비포/애프터 모드에서 2장 선택 완료시 자동 적용
async function _checkAndApplyBA() {
  if (!_baMode || _popupSelIds.size < 2) return;
  await _bulkApplyBA();
  _baMode = false;
  const btn = document.getElementById('baBtnToolbar');
  if (btn) {
    btn.style.background = '#fff';
    btn.style.color = 'var(--text)';
    btn.style.borderColor = 'var(--border)';
  }
}

async function _bulkApplyBA() {
  if (_popupSelIds.size < 2) {
    showToast('사진 2장 선택해주세요');
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
  showToast('비포/애프터 완료! [되돌리기]로 원본 복원 가능해요 ✅');
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

async function _bulkDeletePopup() {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot || !_popupSelIds.size) return;
  if (!confirm(`선택한 ${_popupSelIds.size}장을 삭제할까요?`)) return;
  slot.photos = slot.photos.filter(p => !_popupSelIds.has(p.id));
  try { await saveSlotToDB(slot); } catch(_e) {}
  _popupSelIds.clear();
  _renderPopupPhotoGrid(slot);
  _renderSlotCards();
  showToast('삭제됨');
}

// ═══════════════════════════════════════════════════════
// 비포/애프터 합성 (app-portfolio.js 공유 유틸 사용)
// ═══════════════════════════════════════════════════════
async function _applyBABetween(before, after, slot) {
  try {
    const beforeImg = await _loadImageSrc(before.editedDataUrl || before.dataUrl);
    const afterImg  = await _loadImageSrc(after.editedDataUrl || after.dataUrl);
    const canvas    = document.createElement('canvas');
    renderBASplit(canvas, beforeImg, afterImg, 1080, 1080);
    before.editedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    before.mode = 'ba';
    await saveSlotToDB(slot);
  } catch(e) { showToast('오류: ' + e.message); }
}

// ═══════════════════════════════════════════════════════
// 배경창고 (슬롯 편집 도구)
// ═══════════════════════════════════════════════════════
const DEFAULT_BACKGROUNDS = [
  { id: 'cloud_bw', name: '구름(흑백)', type: 'preset', color: '#f5f5f5', gradient: 'linear-gradient(180deg,#e8e8e8 0%,#f8f8f8 50%,#e0e0e0 100%)' },
  { id: 'cloud_color', name: '구름(컬러)', type: 'preset', color: '#e8f4fc', gradient: 'linear-gradient(180deg,#d4e8f7 0%,#f0f7fc 50%,#c5dff0 100%)' },
  { id: 'pink', name: '핑크', type: 'preset', color: '#fff0f3', gradient: 'linear-gradient(180deg,#ffe4ec 0%,#fff5f7 50%,#ffd6e0 100%)' },
  { id: 'white', name: '화이트', type: 'preset', color: '#ffffff', gradient: 'linear-gradient(180deg,#f8f8f8 0%,#ffffff 50%,#f5f5f5 100%)' },
];

let _selectedBgId = 'cloud_bw';

function _loadUserBgs() {
  try { return JSON.parse(localStorage.getItem('itdasy_user_bgs') || '[]'); } catch(_) { return []; }
}
function _saveUserBgs(arr) {
  localStorage.setItem('itdasy_user_bgs', JSON.stringify(arr));
}
function _loadFavBgs() {
  try { return JSON.parse(localStorage.getItem('itdasy_fav_bgs') || '[]'); } catch(_) { return []; }
}
function _saveFavBgs(arr) {
  localStorage.setItem('itdasy_fav_bgs', JSON.stringify(arr));
}

function openBgPanel() {
  document.getElementById('bgPanel').style.display = 'block';
  _renderBgPanel();
}
function closeBgPanel() {
  document.getElementById('bgPanel').style.display = 'none';
}

function _renderBgPanel() {
  const body = document.getElementById('bgPanelBody');
  if (!body) return;

  const userBgs = _loadUserBgs();
  const favIds = _loadFavBgs();
  const allBgs = [...DEFAULT_BACKGROUNDS, ...userBgs];

  // 즐겨찾기 상단, 나머지 아래
  const favBgs = allBgs.filter(b => favIds.includes(b.id));
  const otherBgs = allBgs.filter(b => !favIds.includes(b.id));

  const renderCard = (bg, isFav) => {
    const isSelected = _selectedBgId === bg.id;
    const isUser = bg.type === 'user';
    const preview = bg.imageData
      ? `<img src="${bg.imageData}" style="width:100%;height:100%;object-fit:cover;">`
      : `<div style="width:100%;height:100%;background:${bg.gradient || bg.color};"></div>`;

    return `
      <div onclick="selectBg('${bg.id}')" style="position:relative;cursor:pointer;">
        <div style="aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:${isSelected ? '3px solid var(--accent)' : '1.5px solid var(--border)'};">
          ${preview}
        </div>
        <div style="font-size:10px;color:var(--text2);text-align:center;margin-top:4px;font-weight:600;">${bg.name}</div>
        <!-- 즐겨찾기 토글 -->
        <button onclick="toggleFavBg('${bg.id}',event)" style="position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(255,255,255,0.9);font-size:12px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.15);">${isFav ? '⭐' : '☆'}</button>
        ${isUser ? `<button onclick="deleteUserBg('${bg.id}',event)" style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(255,255,255,0.9);color:#dc3545;font-size:14px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.15);">×</button>` : ''}
      </div>
    `;
  };

  body.innerHTML = `
    ${favBgs.length ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">⭐ 즐겨찾기</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          ${favBgs.map(bg => renderCard(bg, true)).join('')}
        </div>
      </div>
    ` : ''}
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">🎨 배경 선택</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
        ${otherBgs.map(bg => renderCard(bg, false)).join('')}
        <!-- 추가 버튼 -->
        <div onclick="addUserBg()" style="cursor:pointer;">
          <div style="aspect-ratio:1/1;border-radius:12px;border:1.5px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--text3);">+</div>
          <div style="font-size:10px;color:var(--text3);text-align:center;margin-top:4px;">추가</div>
        </div>
      </div>
    </div>
    <input type="file" id="bgUploadInput" accept="image/*" style="display:none;" onchange="handleBgUpload(this)">
    <button onclick="applySelectedBg()" style="width:100%;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:14px;font-weight:800;cursor:pointer;">선택한 배경 적용하기</button>
  `;
}

function selectBg(id) {
  _selectedBgId = id;
  _renderBgPanel();
}

function toggleFavBg(id, e) {
  e.stopPropagation();
  const favs = _loadFavBgs();
  if (favs.includes(id)) {
    _saveFavBgs(favs.filter(f => f !== id));
  } else {
    _saveFavBgs([...favs, id]);
  }
  _renderBgPanel();
}

function addUserBg() {
  document.getElementById('bgUploadInput').click();
}

function handleBgUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const name = prompt('배경 이름을 입력하세요:', file.name.replace(/\.[^.]+$/, ''));
    if (!name) return;
    const userBgs = _loadUserBgs();
    userBgs.push({
      id: 'user_' + Date.now(),
      name: name.slice(0, 10),
      type: 'user',
      imageData: e.target.result,
    });
    _saveUserBgs(userBgs);
    _renderBgPanel();
    showToast('배경이 추가됐어요!');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function deleteUserBg(id, e) {
  e.stopPropagation();
  if (!confirm('이 배경을 삭제할까요?')) return;
  const userBgs = _loadUserBgs();
  _saveUserBgs(userBgs.filter(b => b.id !== id));
  const favs = _loadFavBgs();
  _saveFavBgs(favs.filter(f => f !== id));
  if (_selectedBgId === id) _selectedBgId = 'cloud_bw';
  _renderBgPanel();
  showToast('삭제됐어요');
}

async function applySelectedBg() {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;

  const selectedPhotos = slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden);
  if (!selectedPhotos.length) {
    showToast('먼저 사진을 선택해주세요');
    return;
  }

  const allBgs = [...DEFAULT_BACKGROUNDS, ..._loadUserBgs()];
  const bg = allBgs.find(b => b.id === _selectedBgId);
  if (!bg) return;

  closeBgPanel();
  const progress = document.getElementById('popupProgress');
  if (progress) { progress.style.display = 'block'; progress.textContent = `배경 합성 중... 0/${selectedPhotos.length}`; }

  for (let i = 0; i < selectedPhotos.length; i++) {
    const photo = selectedPhotos[i];
    if (progress) progress.textContent = `배경 합성 중... ${i + 1}/${selectedPhotos.length}`;
    try {
      await _applyBgToPhoto(photo, bg, slot);
    } catch(e) {
      console.warn('배경 합성 실패:', e);
    }
  }

  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _renderPopupPhotoGrid(slot);
  showToast(`${selectedPhotos.length}장에 배경 적용 완료!`);
}

async function _applyBgToPhoto(photo, bg, slot) {
  // 누끼 이미지가 있으면 사용, 없으면 API 호출
  let personImg;
  if (photo.removedBgUrl) {
    personImg = await _loadImageSrc(photo.removedBgUrl);
  } else {
    // 누끼 API 호출 (FormData 방식)
    const blob = _dataUrlToBlob(photo.dataUrl);
    const fd = new FormData();
    fd.append('file', blob, 'photo.jpg');
    const res = await fetch(API + '/image/remove-bg', { method: 'POST', headers: authHeader(), body: fd });
    if (res.status === 429) throw new Error('한도 초과');
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || '누끼 실패');
    const url = URL.createObjectURL(await res.blob());
    personImg = await _loadImageSrc(url);
    URL.revokeObjectURL(url);
    // 캐싱용
    const cacheCanvas = document.createElement('canvas');
    cacheCanvas.width = personImg.width; cacheCanvas.height = personImg.height;
    cacheCanvas.getContext('2d').drawImage(personImg, 0, 0);
    photo.removedBgUrl = cacheCanvas.toDataURL('image/png');
  }

  // 배경 이미지 로드 또는 그라데이션 캔버스 생성
  let bgCanvas;
  if (bg.imageData) {
    const bgImg = await _loadImageSrc(bg.imageData);
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = 1080; bgCanvas.height = 1080;
    const ctx = bgCanvas.getContext('2d');
    _drawCoverCtx(ctx, bgImg, 0, 0, 1080, 1080);
  } else {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = 1080; bgCanvas.height = 1080;
    const ctx = bgCanvas.getContext('2d');
    if (bg.gradient) {
      const grad = ctx.createLinearGradient(0, 0, 0, 1080);
      // 파싱 간소화: 단색 폴백
      ctx.fillStyle = bg.color || '#fff';
      ctx.fillRect(0, 0, 1080, 1080);
      // 그라데이션 효과 추가
      const grad2 = ctx.createLinearGradient(0, 0, 0, 1080);
      grad2.addColorStop(0, 'rgba(0,0,0,0.03)');
      grad2.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      grad2.addColorStop(1, 'rgba(0,0,0,0.05)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, 1080, 1080);
    } else {
      ctx.fillStyle = bg.color || '#fff';
      ctx.fillRect(0, 0, 1080, 1080);
    }
  }

  // 합성
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = 1080; finalCanvas.height = 1080;
  const fCtx = finalCanvas.getContext('2d');
  fCtx.drawImage(bgCanvas, 0, 0);

  // 인물 중앙 배치 (비율 유지)
  const scale = Math.min(1080 / personImg.width, 1080 / personImg.height) * 0.9;
  const pw = personImg.width * scale;
  const ph = personImg.height * scale;
  fCtx.drawImage(personImg, (1080 - pw) / 2, (1080 - ph) / 2, pw, ph);

  photo.editedDataUrl = finalCanvas.toDataURL('image/jpeg', 0.9);
  photo.mode = 'bg_' + bg.id;
  await saveSlotToDB(slot);
}

// ═══════════════════════════════════════════════════════
// 요소창고 (로고, 브랜드 이미지)
// ═══════════════════════════════════════════════════════
let _userElements = [];
let _elementEditState = null; // { photoId, elementId, x, y, scale, opacity, imgData }

// 기본 텍스트 요소 생성
function _createDefaultTextElement(text, color = '#f18091') {
  const canvas = document.createElement('canvas');
  canvas.width = 300; canvas.height = 100;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 48px sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 150, 50);
  return canvas.toDataURL('image/png');
}

function _loadUserElements() {
  try { return JSON.parse(localStorage.getItem('itdasy_user_elements') || '[]'); } catch(_) { return []; }
}
function _saveUserElements(arr) {
  localStorage.setItem('itdasy_user_elements', JSON.stringify(arr));
}

function openElementPanel() {
  document.getElementById('elementPanel').style.display = 'block';
  _renderElementPanel();
}
function closeElementPanel() {
  document.getElementById('elementPanel').style.display = 'none';
}

function _renderElementPanel() {
  const body = document.getElementById('elementPanelBody');
  if (!body) return;

  _userElements = _loadUserElements();

  const slot = _slots.find(s => s.id === _popupSlotId);
  const selectedPhotos = slot ? slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden) : [];

  // 기본 "잇데이" 텍스트 요소 이미지
  const itdasyImg = _createDefaultTextElement('잇데이', '#f18091');

  body.innerHTML = `
    <!-- 기본 텍스트 요소 -->
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">✨ 기본 텍스트</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
        <div style="cursor:pointer;" onclick="selectDefaultElement('itdasy')">
          <div style="aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:1.5px solid var(--accent);background:#fff5f7;display:flex;align-items:center;justify-content:center;">
            <img src="${itdasyImg}" style="width:90%;height:auto;object-fit:contain;">
          </div>
          <div style="font-size:9px;color:var(--accent);text-align:center;margin-top:4px;font-weight:700;">잇데이</div>
        </div>
      </div>
    </div>
    <!-- 내 요소 -->
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">📦 내 요소 (로고, 브랜드 이미지)</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
        ${_userElements.map(el => `
          <div style="position:relative;cursor:pointer;" onclick="selectElement('${el.id}')">
            <div style="aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:1.5px solid var(--border);background:#f5f5f5;">
              <img src="${el.imageData}" style="width:100%;height:100%;object-fit:contain;">
            </div>
            <div style="font-size:9px;color:var(--text2);text-align:center;margin-top:4px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${el.name}</div>
            <button onclick="deleteElement('${el.id}',event)" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;border:none;background:rgba(220,53,69,0.9);color:#fff;font-size:12px;cursor:pointer;">×</button>
          </div>
        `).join('')}
        <!-- 추가 버튼 -->
        <div onclick="addUserElement()" style="cursor:pointer;">
          <div style="aspect-ratio:1/1;border-radius:12px;border:1.5px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--text3);">+</div>
          <div style="font-size:9px;color:var(--text3);text-align:center;margin-top:4px;">추가</div>
        </div>
      </div>
    </div>
    <input type="file" id="elementUploadInput" accept="image/*" style="display:none;" onchange="handleElementUpload(this)">
    ${selectedPhotos.length === 0 ? `
      <div style="padding:16px;background:var(--bg2);border-radius:12px;text-align:center;color:var(--text3);font-size:12px;">
        사진을 먼저 선택한 후 요소를 탭하세요
      </div>
    ` : `
      <div style="padding:12px;background:rgba(241,128,145,0.08);border-radius:12px;text-align:center;color:var(--accent2);font-size:12px;font-weight:600;">
        ${selectedPhotos.length}장 선택됨 — 요소를 탭하면 편집 화면으로 이동해요
      </div>
    `}
  `;
}

function addUserElement() {
  document.getElementById('elementUploadInput').click();
}

function handleElementUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const name = prompt('요소 이름 (예: 로고, 워터마크):', file.name.replace(/\.[^.]+$/, ''));
    if (!name) return;
    const elements = _loadUserElements();
    elements.push({
      id: 'el_' + Date.now(),
      name: name.slice(0, 12),
      imageData: e.target.result,
    });
    _saveUserElements(elements);
    _renderElementPanel();
    showToast('요소가 추가됐어요!');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function deleteElement(id, e) {
  e.stopPropagation();
  if (!confirm('이 요소를 삭제할까요?')) return;
  const elements = _loadUserElements();
  _saveUserElements(elements.filter(el => el.id !== id));
  _renderElementPanel();
}

function selectElement(elementId) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;

  const selectedPhotos = slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden);
  if (!selectedPhotos.length) {
    showToast('먼저 사진을 선택해주세요');
    return;
  }

  const element = _loadUserElements().find(el => el.id === elementId);
  if (!element) return;

  // 첫 번째 선택 사진으로 편집기 열기
  const photo = selectedPhotos[0];
  _elementEditState = {
    photoId: photo.id,
    allPhotoIds: selectedPhotos.map(p => p.id),
    elementId,
    elementImg: element.imageData,
    x: 50, y: 50, // % 기준 중앙
    scale: 30, // % 기준
    opacity: 100,
  };

  closeElementPanel();
  _openElementEditor(photo);
}

function selectDefaultElement(type) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;

  const selectedPhotos = slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden);
  if (!selectedPhotos.length) {
    showToast('먼저 사진을 선택해주세요');
    return;
  }

  // 기본 텍스트 요소 생성
  let elementImg;
  if (type === 'itdasy') {
    elementImg = _createDefaultTextElement('잇데이', '#f18091');
  } else {
    return;
  }

  const photo = selectedPhotos[0];
  _elementEditState = {
    photoId: photo.id,
    allPhotoIds: selectedPhotos.map(p => p.id),
    elementId: '_default_' + type,
    elementImg,
    x: 50, y: 85, // 하단 중앙
    scale: 25,
    opacity: 100,
  };

  closeElementPanel();
  _openElementEditor(photo);
}

function _openElementEditor(photo) {
  const editor = document.getElementById('elementEditor');
  const canvas = document.getElementById('elementEditorCanvas');
  editor.style.display = 'block';

  const photoSrc = photo.editedDataUrl || photo.dataUrl;
  canvas.innerHTML = `
    <div id="elemEditWrap" style="position:relative;width:90%;max-width:400px;aspect-ratio:1/1;">
      <img src="${photoSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">
      <img id="elemOverlay" src="${_elementEditState.elementImg}" style="position:absolute;left:${_elementEditState.x}%;top:${_elementEditState.y}%;transform:translate(-50%,-50%);width:${_elementEditState.scale}%;opacity:${_elementEditState.opacity/100};pointer-events:none;">
    </div>
  `;

  document.getElementById('elementOpacity').value = _elementEditState.opacity;
  document.getElementById('elementOpacityVal').textContent = _elementEditState.opacity + '%';

  // 터치/마우스 드래그 설정
  _setupElementDrag();
}

function _setupElementDrag() {
  const wrap = document.getElementById('elemEditWrap');
  const overlay = document.getElementById('elemOverlay');
  if (!wrap || !overlay) return;

  let dragging = false, startX, startY, startElemX, startElemY;
  let pinching = false, startDist, startScale;

  const getPos = (clientX, clientY) => {
    const rect = wrap.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const updateOverlay = () => {
    overlay.style.left = _elementEditState.x + '%';
    overlay.style.top = _elementEditState.y + '%';
    overlay.style.width = _elementEditState.scale + '%';
    overlay.style.opacity = _elementEditState.opacity / 100;
  };

  // 터치
  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      pinching = true;
      startDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      startScale = _elementEditState.scale;
    } else if (e.touches.length === 1) {
      dragging = true;
      const pos = getPos(e.touches[0].clientX, e.touches[0].clientY);
      startX = pos.x; startY = pos.y;
      startElemX = _elementEditState.x; startElemY = _elementEditState.y;
    }
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    if (pinching && e.touches.length === 2) {
      const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      _elementEditState.scale = Math.max(10, Math.min(80, startScale * (dist / startDist)));
      updateOverlay();
      e.preventDefault();
    } else if (dragging && e.touches.length === 1) {
      const pos = getPos(e.touches[0].clientX, e.touches[0].clientY);
      _elementEditState.x = Math.max(5, Math.min(95, startElemX + (pos.x - startX)));
      _elementEditState.y = Math.max(5, Math.min(95, startElemY + (pos.y - startY)));
      updateOverlay();
    }
  }, { passive: false });

  wrap.addEventListener('touchend', () => { dragging = false; pinching = false; });

  // 마우스
  wrap.addEventListener('mousedown', e => {
    dragging = true;
    const pos = getPos(e.clientX, e.clientY);
    startX = pos.x; startY = pos.y;
    startElemX = _elementEditState.x; startElemY = _elementEditState.y;
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect = wrap.getBoundingClientRect();
    const pos = { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
    _elementEditState.x = Math.max(5, Math.min(95, startElemX + (pos.x - startX)));
    _elementEditState.y = Math.max(5, Math.min(95, startElemY + (pos.y - startY)));
    updateOverlay();
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  // 마우스 휠 크기 조절
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    _elementEditState.scale = Math.max(10, Math.min(80, _elementEditState.scale - e.deltaY * 0.05));
    updateOverlay();
  }, { passive: false });
}

function updateElementOpacity(val) {
  _elementEditState.opacity = parseInt(val);
  document.getElementById('elementOpacityVal').textContent = val + '%';
  const overlay = document.getElementById('elemOverlay');
  if (overlay) overlay.style.opacity = val / 100;
}

function cancelElementEdit() {
  document.getElementById('elementEditor').style.display = 'none';
  _elementEditState = null;
}

async function saveElementEdit() {
  if (!_elementEditState) return;

  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;

  const progress = document.getElementById('popupProgress');
  document.getElementById('elementEditor').style.display = 'none';

  const photoIds = _elementEditState.allPhotoIds;
  if (progress) { progress.style.display = 'block'; progress.textContent = `요소 적용 중... 0/${photoIds.length}`; }

  for (let i = 0; i < photoIds.length; i++) {
    const photo = slot.photos.find(p => p.id === photoIds[i]);
    if (!photo) continue;
    if (progress) progress.textContent = `요소 적용 중... ${i + 1}/${photoIds.length}`;
    await _applyElementToPhoto(photo, slot);
  }

  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _elementEditState = null;
  _renderPopupPhotoGrid(slot);
  showToast(`${photoIds.length}장에 요소 적용 완료!`);
}

async function _applyElementToPhoto(photo, slot) {
  const state = _elementEditState;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // 베이스 이미지
  const baseImg = await _loadImageSrc(photo.editedDataUrl || photo.dataUrl);
  _drawCoverCtx(ctx, baseImg, 0, 0, 1080, 1080);

  // 요소 이미지
  const elemImg = await _loadImageSrc(state.elementImg);
  const elemW = 1080 * (state.scale / 100);
  const elemH = elemW * (elemImg.height / elemImg.width);
  const elemX = 1080 * (state.x / 100) - elemW / 2;
  const elemY = 1080 * (state.y / 100) - elemH / 2;

  ctx.globalAlpha = state.opacity / 100;
  ctx.drawImage(elemImg, elemX, elemY, elemW, elemH);
  ctx.globalAlpha = 1;

  photo.editedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  photo.mode = 'element';
  await saveSlotToDB(slot);
}

// ═══════════════════════════════════════════════════════
// 템플릿 (배경 + 요소 조합)
// ═══════════════════════════════════════════════════════
const DEFAULT_TEMPLATES = [
  { id: 'tpl_hair1', name: '붙임머리 기본', shopType: '붙임머리', bgId: 'pink', elements: [] },
  { id: 'tpl_hair2', name: '붙임머리 심플', shopType: '붙임머리', bgId: 'white', elements: [] },
  { id: 'tpl_nail1', name: '네일 핑크', shopType: '네일', bgId: 'pink', elements: [] },
  { id: 'tpl_nail2', name: '네일 클라우드', shopType: '네일', bgId: 'cloud_color', elements: [] },
];

function _loadUserTemplates() {
  try { return JSON.parse(localStorage.getItem('itdasy_user_templates') || '[]'); } catch(_) { return []; }
}
function _saveUserTemplates(arr) {
  localStorage.setItem('itdasy_user_templates', JSON.stringify(arr));
}

function openTemplatePanel() {
  document.getElementById('templatePanel').style.display = 'block';
  _renderTemplatePanel();
}
function closeTemplatePanel() {
  document.getElementById('templatePanel').style.display = 'none';
}

function _renderTemplatePanel() {
  const body = document.getElementById('templatePanelBody');
  if (!body) return;

  const shopType = localStorage.getItem('shop_type') || '붙임머리';
  const userTemplates = _loadUserTemplates();
  const defaultForShop = DEFAULT_TEMPLATES.filter(t => t.shopType === shopType || t.shopType === '공통');
  const allBgs = [...DEFAULT_BACKGROUNDS, ..._loadUserBgs()];

  const renderCard = (tpl, isUser) => {
    const bg = allBgs.find(b => b.id === tpl.bgId) || allBgs[0];
    const preview = bg.imageData
      ? `<img src="${bg.imageData}" style="width:100%;height:100%;object-fit:cover;">`
      : `<div style="width:100%;height:100%;background:${bg.gradient || bg.color};"></div>`;
    return `
      <div style="position:relative;cursor:pointer;" onclick="applyTemplate('${tpl.id}')">
        <div style="aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:1.5px solid var(--border);">${preview}</div>
        <div style="font-size:10px;color:var(--text2);text-align:center;margin-top:4px;font-weight:600;">${tpl.name}</div>
        ${isUser ? `<button onclick="deleteTemplate('${tpl.id}',event)" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;border:none;background:rgba(220,53,69,0.9);color:#fff;font-size:12px;cursor:pointer;">×</button>` : ''}
      </div>
    `;
  };

  body.innerHTML = `
    ${userTemplates.length ? `<div style="margin-bottom:16px;"><div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">💾 내 템플릿</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">${userTemplates.map(t => renderCard(t, true)).join('')}</div></div>` : ''}
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">📐 기본 템플릿 (${shopType})</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">${defaultForShop.map(t => renderCard(t, false)).join('')}</div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">현재 설정을 템플릿으로 저장</div>
      <div style="display:flex;gap:8px;">
        <input type="text" id="newTemplateName" placeholder="템플릿 이름" style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid var(--border);font-size:13px;">
        <button onclick="saveCurrentAsTemplate()" style="padding:10px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:12px;font-weight:700;cursor:pointer;">저장</button>
      </div>
    </div>
  `;
}

async function applyTemplate(tplId) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const selectedPhotos = slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden);
  if (!selectedPhotos.length) { showToast('먼저 사진을 선택해주세요'); return; }
  const allTemplates = [...DEFAULT_TEMPLATES, ..._loadUserTemplates()];
  const tpl = allTemplates.find(t => t.id === tplId);
  if (!tpl) return;
  closeTemplatePanel();
  const progress = document.getElementById('popupProgress');
  if (progress) { progress.style.display = 'block'; progress.textContent = `템플릿 적용 중...`; }
  const allBgs = [...DEFAULT_BACKGROUNDS, ..._loadUserBgs()];
  const bg = allBgs.find(b => b.id === tpl.bgId);
  for (const photo of selectedPhotos) {
    if (bg) try { await _applyBgToPhoto(photo, bg, slot); } catch(_e) {}
  }
  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _renderPopupPhotoGrid(slot);
  showToast(`${selectedPhotos.length}장에 템플릿 적용 완료!`);
}

function saveCurrentAsTemplate() {
  const name = document.getElementById('newTemplateName')?.value?.trim();
  if (!name) { showToast('템플릿 이름을 입력해주세요'); return; }
  const templates = _loadUserTemplates();
  templates.push({ id: 'tpl_user_' + Date.now(), name: name.slice(0, 12), shopType: localStorage.getItem('shop_type') || '붙임머리', bgId: _selectedBgId || 'white', elements: [] });
  _saveUserTemplates(templates);
  _renderTemplatePanel();
  showToast('템플릿 저장됨!');
}

function deleteTemplate(id, e) {
  e.stopPropagation();
  if (!confirm('이 템플릿을 삭제할까요?')) return;
  _saveUserTemplates(_loadUserTemplates().filter(t => t.id !== id));
  _renderTemplatePanel();
}

// ═══════════════════════════════════════════════════════
// 리뷰 스티커 (Gemini Vision 텍스트 추출 + 감성 카드)
// ═══════════════════════════════════════════════════════
let _reviewEditState = null;
let _reviewStickerCache = [];

function openReviewPanel() {
  document.getElementById('reviewPanel').style.display = 'block';
  _renderReviewPanel();
}
function closeReviewPanel() {
  document.getElementById('reviewPanel').style.display = 'none';
}

function _renderReviewPanel() {
  const body = document.getElementById('reviewPanelBody');
  if (!body) return;
  body.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">📸 리뷰 스크린샷 업로드</div>
      <div style="text-align:center;padding:20px;border:2px dashed var(--border);border-radius:14px;cursor:pointer;background:var(--bg2);" onclick="document.getElementById('reviewUploadInput').click()">
        <div style="font-size:32px;margin-bottom:8px;">📱</div>
        <div style="font-size:13px;color:var(--text2);font-weight:600;">네이버/카톡 리뷰 캡처 올리기</div>
      </div>
      <input type="file" id="reviewUploadInput" accept="image/*" style="display:none;" onchange="handleReviewUpload(this)">
    </div>
    <div id="reviewExtractResult" style="display:none;margin-bottom:16px;"></div>
    ${_reviewStickerCache.length ? `<div style="margin-bottom:16px;"><div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;">📸 업로드된 리뷰 (탭해서 선택)</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">${_reviewStickerCache.map((s,i) => `<div style="cursor:pointer;border-radius:12px;overflow:hidden;border:1.5px solid var(--border);" onclick="selectReviewSticker(${i})"><img src="${s}" style="width:100%;display:block;"></div>`).join('')}</div></div>` : ''}
  `;
}

async function handleReviewUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const resultDiv = document.getElementById('reviewExtractResult');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);">스크린샷 준비 중... ✨</div>`;
  try {
    const dataUrl = await _fileToDataUrl(file);
    // 스크린샷 직접 사용 (AI 추출 없이)
    _reviewStickerCache.unshift(dataUrl);
    if (_reviewStickerCache.length > 6) _reviewStickerCache.pop();
    resultDiv.innerHTML = `<div style="background:var(--bg2);border:1.5px solid var(--border);border-radius:14px;padding:14px;text-align:center;">
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px;">업로드된 리뷰 스크린샷</div>
      <img src="${dataUrl}" style="max-width:100%;max-height:200px;border-radius:10px;object-fit:contain;">
    </div>`;
    _renderReviewPanel();
    showToast('스크린샷이 추가됐어요! 아래에서 선택해 사진에 붙이세요 ✨');
  } catch(e) { resultDiv.innerHTML = `<div style="color:#dc3545;">업로드 실패: ${e.message}</div>`; }
  input.value = '';
}

function selectReviewSticker(idx) {
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const selectedPhotos = slot.photos.filter(p => _popupSelIds.has(p.id) && !p.hidden);
  if (!selectedPhotos.length) { showToast('먼저 사진을 선택해주세요'); return; }
  const stickerDataUrl = _reviewStickerCache[idx];
  if (!stickerDataUrl) return;
  _reviewEditState = { photoId: selectedPhotos[0].id, allPhotoIds: selectedPhotos.map(p => p.id), stickerImg: stickerDataUrl, x: 50, y: 75, scale: 40, opacity: 100 };
  closeReviewPanel();
  _openReviewEditor(selectedPhotos[0]);
}

function _openReviewEditor(photo) {
  const editor = document.getElementById('reviewEditor');
  const canvas = document.getElementById('reviewEditorCanvas');
  editor.style.display = 'block';
  canvas.innerHTML = `<div id="reviewEditWrap" style="position:relative;width:90%;max-width:400px;aspect-ratio:1/1;"><img src="${photo.editedDataUrl || photo.dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"><img id="reviewOverlay" src="${_reviewEditState.stickerImg}" style="position:absolute;left:${_reviewEditState.x}%;top:${_reviewEditState.y}%;transform:translate(-50%,-50%);width:${_reviewEditState.scale}%;opacity:${_reviewEditState.opacity/100};pointer-events:none;"></div>`;
  document.getElementById('reviewScale').value = _reviewEditState.scale;
  document.getElementById('reviewScaleVal').textContent = _reviewEditState.scale + '%';
  document.getElementById('reviewOpacity').value = _reviewEditState.opacity;
  document.getElementById('reviewOpacityVal').textContent = _reviewEditState.opacity + '%';
  _setupReviewDrag();
}

function _setupReviewDrag() {
  const wrap = document.getElementById('reviewEditWrap');
  const overlay = document.getElementById('reviewOverlay');
  if (!wrap || !overlay) return;
  let dragging = false, startX, startY, startElemX, startElemY, pinching = false, startDist, startScale;
  const getPos = (x, y) => { const r = wrap.getBoundingClientRect(); return { x: ((x - r.left) / r.width) * 100, y: ((y - r.top) / r.height) * 100 }; };
  const update = () => { overlay.style.left = _reviewEditState.x + '%'; overlay.style.top = _reviewEditState.y + '%'; overlay.style.width = _reviewEditState.scale + '%'; overlay.style.opacity = _reviewEditState.opacity / 100; };
  wrap.addEventListener('touchstart', e => { e.preventDefault(); if (e.touches.length === 2) { pinching = true; startDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY); startScale = _reviewEditState.scale; } else { dragging = true; const p = getPos(e.touches[0].clientX, e.touches[0].clientY); startX = p.x; startY = p.y; startElemX = _reviewEditState.x; startElemY = _reviewEditState.y; } }, { passive: false });
  wrap.addEventListener('touchmove', e => { if (pinching && e.touches.length === 2) { const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY); _reviewEditState.scale = Math.max(15, Math.min(80, startScale * (d / startDist))); update(); e.preventDefault(); } else if (dragging) { const p = getPos(e.touches[0].clientX, e.touches[0].clientY); _reviewEditState.x = Math.max(10, Math.min(90, startElemX + (p.x - startX))); _reviewEditState.y = Math.max(10, Math.min(90, startElemY + (p.y - startY))); update(); } }, { passive: false });
  wrap.addEventListener('touchend', () => { dragging = false; pinching = false; });
  wrap.addEventListener('mousedown', e => { dragging = true; const p = getPos(e.clientX, e.clientY); startX = p.x; startY = p.y; startElemX = _reviewEditState.x; startElemY = _reviewEditState.y; e.preventDefault(); });
  window.addEventListener('mousemove', e => { if (!dragging) return; const r = wrap.getBoundingClientRect(); const p = { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }; _reviewEditState.x = Math.max(10, Math.min(90, startElemX + (p.x - startX))); _reviewEditState.y = Math.max(10, Math.min(90, startElemY + (p.y - startY))); update(); });
  window.addEventListener('mouseup', () => { dragging = false; });
  wrap.addEventListener('wheel', e => { e.preventDefault(); _reviewEditState.scale = Math.max(15, Math.min(80, _reviewEditState.scale - e.deltaY * 0.05)); update(); }, { passive: false });
}

function updateReviewOpacity(val) {
  _reviewEditState.opacity = parseInt(val);
  document.getElementById('reviewOpacityVal').textContent = val + '%';
  const o = document.getElementById('reviewOverlay');
  if (o) o.style.opacity = val / 100;
}

function updateReviewScale(val) {
  _reviewEditState.scale = parseInt(val);
  document.getElementById('reviewScaleVal').textContent = val + '%';
  const o = document.getElementById('reviewOverlay');
  if (o) o.style.width = val + '%';
}

function cancelReviewEdit() {
  document.getElementById('reviewEditor').style.display = 'none';
  _reviewEditState = null;
}

async function saveReviewEdit() {
  if (!_reviewEditState) return;
  const slot = _slots.find(s => s.id === _popupSlotId);
  if (!slot) return;
  const progress = document.getElementById('popupProgress');
  document.getElementById('reviewEditor').style.display = 'none';
  const photoIds = _reviewEditState.allPhotoIds;
  if (progress) { progress.style.display = 'block'; progress.textContent = `스티커 적용 중...`; }
  for (const pid of photoIds) {
    const photo = slot.photos.find(p => p.id === pid);
    if (!photo) continue;
    await _applyReviewToPhoto(photo, slot);
  }
  if (progress) progress.style.display = 'none';
  _popupSelIds.clear();
  _reviewEditState = null;
  _renderPopupPhotoGrid(slot);
  showToast(`${photoIds.length}장에 스티커 적용 완료!`);
}

async function _applyReviewToPhoto(photo, slot) {
  const state = _reviewEditState;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const baseImg = await _loadImageSrc(photo.editedDataUrl || photo.dataUrl);
  _drawCoverCtx(ctx, baseImg, 0, 0, 1080, 1080);
  const stickerImg = await _loadImageSrc(state.stickerImg);
  const stickerW = 1080 * (state.scale / 100);
  const stickerH = stickerW * (stickerImg.height / stickerImg.width);
  ctx.globalAlpha = state.opacity / 100;
  ctx.drawImage(stickerImg, 1080 * (state.x / 100) - stickerW / 2, 1080 * (state.y / 100) - stickerH / 2, stickerW, stickerH);
  ctx.globalAlpha = 1;
  photo.editedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  photo.mode = 'review_sticker';
  await saveSlotToDB(slot);
}

// ═══════════════════════════════════════════════════════
// 피크 캐러셀 (글쓰기 슬롯 사진 / 미리보기 공용)
// ═══════════════════════════════════════════════════════
function _buildPeekCarousel(photos, id) {
  if (!photos.length) return '<div style="color:var(--text3);text-align:center;padding:16px;font-size:12px;">사진 없음</div>';
  const total = photos.length;
  if (total === 1) {
    return `<div style="width:70%;margin:0 auto;aspect-ratio:1/1;border-radius:14px;overflow:hidden;">
      <img src="${photos[0].editedDataUrl || photos[0].dataUrl}" style="width:100%;height:100%;object-fit:cover;">
    </div>`;
  }
  return `
    <div id="${id}" style="overflow:hidden;position:relative;user-select:none;touch-action:pan-y;">
      <div id="${id}_t" style="display:flex;transform:translateX(15%);transition:transform .35s cubic-bezier(.25,.46,.45,.94);">
        ${photos.map((p, i) => `
          <div style="flex-shrink:0;width:70%;padding:0 2%;box-sizing:border-box;">
            <div class="${id}_s" style="aspect-ratio:1/1;border-radius:14px;overflow:hidden;transition:transform .35s,filter .35s;transform:scale(${i===0?1:.85});filter:${i===0?'none':'brightness(.6)'};">
              <img src="${p.editedDataUrl || p.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;">
            </div>
          </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:center;gap:5px;padding:8px 0 0;" id="${id}_dots">
        ${photos.map((_,i) => `<div id="${id}_d${i}" style="height:6px;border-radius:3px;background:${i?'rgba(0,0,0,0.15)':'var(--accent)'};width:${i?'6':'18'}px;transition:all .3s;"></div>`).join('')}
      </div>
    </div>
  `;
}

function _initPeekCarousel(id, total) {
  const track = document.getElementById(id + '_t');
  if (!track || total < 2) return;
  let cur = 0;
  let offsetPx = 0; // 실시간 드래그 오프셋
  const container = document.getElementById(id);
  const containerW = container?.offsetWidth || 300;
  const slideW = containerW * 0.7; // 70%

  function go(n, animate = true) {
    cur = Math.max(0, Math.min(total - 1, n));
    offsetPx = -cur * slideW;
    track.style.transition = animate ? 'transform .35s cubic-bezier(.25,.46,.45,.94)' : 'none';
    track.style.transform = `translateX(calc(15% + ${offsetPx}px))`;
    track.querySelectorAll('.' + id + '_s').forEach((el, i) => {
      el.style.transform = i === cur ? 'scale(1)' : 'scale(.85)';
      el.style.filter = i === cur ? 'none' : 'brightness(.6)';
    });
    for (let i = 0; i < total; i++) {
      const d = document.getElementById(id + '_d' + i);
      if (d) { d.style.width = i === cur ? '18px' : '6px'; d.style.background = i === cur ? 'var(--accent)' : 'rgba(0,0,0,0.15)'; }
    }
  }

  // 모멘텀 계산용 변수
  let sx = 0, st = 0, dragging = false, lastX = 0, velocity = 0, lastTime = 0;

  track.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    lastX = sx;
    st = Date.now();
    lastTime = st;
    velocity = 0;
    dragging = true;
    track.style.transition = 'none';
  }, { passive: true });

  track.addEventListener('touchmove', e => {
    if (!dragging) return;
    const x = e.touches[0].clientX;
    const dx = x - sx;
    const now = Date.now();
    const dt = now - lastTime;
    if (dt > 0) velocity = (x - lastX) / dt; // px/ms
    lastX = x;
    lastTime = now;
    // 실시간 드래그 반영
    track.style.transform = `translateX(calc(15% + ${offsetPx + dx}px))`;
    if (Math.abs(dx) > 10) e.preventDefault();
  }, { passive: false });

  track.addEventListener('touchend', e => {
    if (!dragging) return;
    dragging = false;
    const dx = e.changedTouches[0].clientX - sx;
    // 모멘텀: 속도 기반으로 몇 슬라이드 이동할지 결정
    const momentum = velocity * 150; // 150ms 관성
    const totalMove = dx + momentum;
    const slidesToMove = Math.round(-totalMove / slideW);
    go(cur + slidesToMove);
  }, { passive: true });

  // 마우스 드래그
  let msx = 0, mst = 0, md = false, mLastX = 0, mVelocity = 0, mLastTime = 0;
  track.addEventListener('mousedown', e => {
    msx = e.clientX;
    mLastX = msx;
    mst = Date.now();
    mLastTime = mst;
    mVelocity = 0;
    md = true;
    track.style.transition = 'none';
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!md) return;
    const x = e.clientX;
    const dx = x - msx;
    const now = Date.now();
    const dt = now - mLastTime;
    if (dt > 0) mVelocity = (x - mLastX) / dt;
    mLastX = x;
    mLastTime = now;
    track.style.transform = `translateX(calc(15% + ${offsetPx + dx}px))`;
  });
  window.addEventListener('mouseup', e => {
    if (!md) return;
    md = false;
    const dx = e.clientX - msx;
    const momentum = mVelocity * 150;
    const totalMove = dx + momentum;
    const slidesToMove = Math.round(-totalMove / slideW);
    go(cur + slidesToMove);
  });
}

// ═══════════════════════════════════════════════════════
// 인스타그램 스타일 캐러셀 (1:1 비율, 풀 너비)
// ═══════════════════════════════════════════════════════
function _buildInstaCarousel(photos, id) {
  if (!photos.length) return '<div style="aspect-ratio:1/1;background:#fafafa;display:flex;align-items:center;justify-content:center;color:#8e8e8e;font-size:13px;">사진 없음</div>';
  const total = photos.length;
  if (total === 1) {
    return `<div style="aspect-ratio:1/1;overflow:hidden;">
      <img src="${photos[0].editedDataUrl || photos[0].dataUrl}" style="width:100%;height:100%;object-fit:cover;">
    </div>`;
  }
  return `
    <div id="${id}" style="overflow:hidden;position:relative;user-select:none;touch-action:pan-y;">
      <div id="${id}_t" style="display:flex;transition:transform .3s cubic-bezier(.25,.46,.45,.94);">
        ${photos.map(p => `
          <div style="flex-shrink:0;width:100%;">
            <div style="aspect-ratio:1/1;overflow:hidden;">
              <img src="${p.editedDataUrl || p.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;">
            </div>
          </div>`).join('')}
      </div>
      <div style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:4px;" id="${id}_dots">
        ${photos.map((_,i) => `<div id="${id}_d${i}" style="width:6px;height:6px;border-radius:50%;background:${i?'rgba(255,255,255,0.5)':'#fff'};transition:all .3s;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`).join('')}
      </div>
    </div>
  `;
}

function _initInstaCarousel(id, total) {
  const track = document.getElementById(id + '_t');
  const container = document.getElementById(id);
  if (!track || !container || total < 2) return;
  let cur = 0;
  const slideW = container.offsetWidth;

  function go(n, animate = true) {
    cur = Math.max(0, Math.min(total - 1, n));
    track.style.transition = animate ? 'transform .3s cubic-bezier(.25,.46,.45,.94)' : 'none';
    track.style.transform = `translateX(${-cur * 100}%)`;
    for (let i = 0; i < total; i++) {
      const d = document.getElementById(id + '_d' + i);
      if (d) d.style.background = i === cur ? '#fff' : 'rgba(255,255,255,0.5)';
    }
  }

  let sx = 0, dragging = false, velocity = 0, lastX = 0, lastTime = 0, startOffset = 0;
  track.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    lastX = sx;
    lastTime = Date.now();
    velocity = 0;
    dragging = true;
    startOffset = -cur * slideW;
    track.style.transition = 'none';
  }, { passive: true });

  track.addEventListener('touchmove', e => {
    if (!dragging) return;
    const x = e.touches[0].clientX;
    const dx = x - sx;
    const now = Date.now();
    if (now - lastTime > 0) velocity = (x - lastX) / (now - lastTime);
    lastX = x;
    lastTime = now;
    track.style.transform = `translateX(${startOffset + dx}px)`;
    if (Math.abs(dx) > 10) e.preventDefault();
  }, { passive: false });

  track.addEventListener('touchend', e => {
    if (!dragging) return;
    dragging = false;
    const dx = e.changedTouches[0].clientX - sx;
    const momentum = velocity * 120;
    const totalMove = dx + momentum;
    const slidesToMove = Math.round(-totalMove / slideW);
    go(cur + slidesToMove);
  }, { passive: true });

  // 마우스 드래그
  let msx = 0, md = false, mVelocity = 0, mLastX = 0, mLastTime = 0, mStartOffset = 0;
  track.addEventListener('mousedown', e => {
    msx = e.clientX;
    mLastX = msx;
    mLastTime = Date.now();
    mVelocity = 0;
    md = true;
    mStartOffset = -cur * slideW;
    track.style.transition = 'none';
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!md) return;
    const x = e.clientX;
    const dx = x - msx;
    const now = Date.now();
    if (now - mLastTime > 0) mVelocity = (x - mLastX) / (now - mLastTime);
    mLastX = x;
    mLastTime = now;
    track.style.transform = `translateX(${mStartOffset + dx}px)`;
  });
  window.addEventListener('mouseup', e => {
    if (!md) return;
    md = false;
    const dx = e.clientX - msx;
    const momentum = mVelocity * 120;
    const totalMove = dx + momentum;
    const slidesToMove = Math.round(-totalMove / slideW);
    go(cur + slidesToMove);
  });
}

// ═══════════════════════════════════════════════════════
// 글쓰기 탭 — 슬롯 픽커
// ═══════════════════════════════════════════════════════
function initCaptionSlotPicker() {
  const doneSlots = _slots.filter(s => s.status === 'done' && s.photos.length > 0);
  const container = document.getElementById('captionSlotPicker');
  if (!container) return;

  // 키워드 태그 렌더링
  if (typeof renderCaptionKeywordTags === 'function') renderCaptionKeywordTags();

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

  // 사진 피크 캐러셀 표시
  const strip = document.getElementById('captionSlotPhotoStrip');
  if (strip && visPhotos.length > 0) {
    strip.style.display = 'block';
    strip.innerHTML = _buildPeekCarousel(visPhotos, 'cs_carousel');
    setTimeout(() => _initPeekCarousel('cs_carousel', visPhotos.length), 50);
  } else if (strip) {
    strip.style.display = 'none';
  }

  showToast(`${slot.label} 연결됐어요 ✅`);

  // 단일 작업 카드의 사진 영역 갱신 (app-caption.js)
  if (typeof _captionPhotosReordered !== 'undefined') _captionPhotosReordered = null;
  if (typeof _renderCaptionPhotoRow === 'function') _renderCaptionPhotoRow();
}

// _csSwipe replaced by _initPeekCarousel

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
    pop.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;';
    pop.onclick = e => { if (e.target === pop) pop.style.display = 'none'; };
    document.body.appendChild(pop);
  }

  const shopName   = localStorage.getItem('shop_name') || '잇데이 스튜디오';
  const shopHandle = (localStorage.getItem('shop_name') || 'itdasy').toLowerCase().replace(/\s/g, '');
  const total      = photos.length;
  const avatarLetter = (shopName[0] || '잇');

  // Instagram-style 1:1 사진 영역 (피크 캐러셀)
  const photoHtml = total
    ? `<div style="position:relative;width:100%;aspect-ratio:1/1;background:#000;overflow:hidden;" id="_pubCarouselWrap">
        <div id="_pub_t" style="display:flex;${total>1?'transform:translateX(15%);':''}transition:transform .35s cubic-bezier(.25,.46,.45,.94);">
          ${photos.map((p, i) => `
            <div style="flex-shrink:0;width:${total>1?70:100}%;${total>1?'padding:0 2%;box-sizing:border-box;':''}">
              <div class="_pub_s" style="aspect-ratio:1/1;overflow:hidden;${total>1?'border-radius:10px;':''};transition:transform .35s,filter .35s;transform:scale(${i===0?1:.85});filter:${i===0?'none':'brightness(.6)'};">
                <img src="${p.editedDataUrl || p.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;">
              </div>
            </div>`).join('')}
        </div>
        ${total > 1 ? `<div style="display:flex;justify-content:center;gap:5px;padding:8px 0 4px;background:#fff;" id="_pub_dots">
          ${photos.map((_,i) => `<div id="_pub_d${i}" style="height:6px;border-radius:3px;background:${i?'rgba(0,0,0,0.15)':'#3897f0'};width:${i?'6':'18'}px;transition:all .3s;"></div>`).join('')}
        </div>` : ''}
      </div>`
    : `<div style="width:100%;aspect-ratio:1/1;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:50px;">📷</div>`;

  const escapedCaption = caption.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  pop.innerHTML = `
    <div style="width:100%;max-width:480px;background:#fff;border-radius:20px 20px 0 0;max-height:92vh;overflow-y:auto;">
      <!-- 드래그 핸들 -->
      <div style="display:flex;justify-content:center;padding:10px 0 0;">
        <div style="width:36px;height:4px;border-radius:2px;background:rgba(0,0,0,0.12);"></div>
      </div>
      <!-- 인스타 피드 헤더 -->
      <div style="display:flex;align-items:center;padding:10px 12px 10px;">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);padding:2px;margin-right:10px;">
          <div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800;">${avatarLetter}</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;line-height:1.2;">${shopName}</div>
          <div style="font-size:10px;color:#999;">sponsored</div>
        </div>
        <button style="padding:4px 12px;border-radius:6px;border:1.5px solid #dbdbdb;background:transparent;font-size:12px;font-weight:600;color:#262626;cursor:pointer;">팔로우</button>
        <button style="background:transparent;border:none;font-size:18px;color:#999;cursor:pointer;margin-left:8px;" onclick="document.getElementById('_captionPubPreviewPop').style.display='none'">×</button>
      </div>
      <!-- 사진 캐러셀 -->
      ${photoHtml}
      <!-- 액션 아이콘 -->
      <div style="display:flex;align-items:center;padding:10px 12px 4px;">
        <svg style="width:24px;height:24px;margin-right:14px;" viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <svg style="width:24px;height:24px;margin-right:14px;" viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <svg style="width:24px;height:24px;" viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        <svg style="width:24px;height:24px;margin-left:auto;" viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="2"><polygon points="19 21 12 16 5 21 5 3 19 3 19 21"/></svg>
      </div>
      <!-- 캡션 -->
      <div style="padding:2px 12px 14px;">
        <div style="font-size:13px;color:#262626;line-height:1.6;"><span style="font-weight:700;">${shopHandle} </span>${escapedCaption || '(캡션 없음)'}</div>
      </div>
      <!-- 발행 버튼 -->
      <div style="padding:0 12px 28px;">
        <button onclick="doPublishFromCaption()" style="width:100%;height:48px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:14px;font-weight:800;cursor:pointer;">인스타에 올리기 🚀</button>
      </div>
    </div>
  `;
  pop.style.display = 'flex';
  window._pubPhotos     = photos;
  window._pubPhotoTotal = total;

  // 캐러셀 초기화
  if (total > 1) {
    setTimeout(() => {
      const track = document.getElementById('_pub_t');
      if (!track) return;
      let cur = 0;
      function pubGo(n) {
        cur = Math.max(0, Math.min(total - 1, n));
        _previewPhotoIdx = cur;
        track.style.transform = `translateX(${15 - cur * 70}%)`;
        track.querySelectorAll('._pub_s').forEach((el, i) => {
          el.style.transform = i === cur ? 'scale(1)' : 'scale(.85)';
          el.style.filter = i === cur ? 'none' : 'brightness(.6)';
        });
        for (let i = 0; i < total; i++) {
          const d = document.getElementById('_pub_d' + i);
          if (d) { d.style.width = i === cur ? '18px' : '6px'; d.style.background = i === cur ? '#3897f0' : 'rgba(0,0,0,0.15)'; }
        }
      }
      let sx = 0, st = 0, dr = false;
      track.addEventListener('touchstart', e => { sx = e.touches[0].clientX; st = Date.now(); dr = true; }, { passive: true });
      track.addEventListener('touchend', e => {
        if (!dr) return; dr = false;
        const dx = e.changedTouches[0].clientX - sx;
        const fast = Math.abs(dx) / (Date.now() - st) > 0.4;
        if (dx < -30 || (fast && dx < 0)) pubGo(cur + 1);
        else if (dx > 30 || (fast && dx > 0)) pubGo(cur - 1);
      }, { passive: true });
      let msx = 0, mst = 0, mdr = false;
      track.addEventListener('mousedown', e => { msx = e.clientX; mst = Date.now(); mdr = true; e.preventDefault(); });
      window.addEventListener('mouseup', e => {
        if (!mdr) return; mdr = false;
        const dx = e.clientX - msx;
        const fast = Math.abs(dx) / (Date.now() - mst) > 0.4;
        if (dx < -30 || (fast && dx < 0)) pubGo(cur + 1);
        else if (dx > 30 || (fast && dx > 0)) pubGo(cur - 1);
      });
    }, 80);
  }
}

// _pubSwipe integrated into _showCaptionPublishPreview carousel

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
  let galleryItems = [];
  try { galleryItems = await loadGalleryItems(); } catch(_e) {}
  _renderFinishTab(root, galleryItems);
}

function _renderFinishTab(root, galleryItems = []) {
  const doneSlots   = _slots.filter(s => s.status === 'done' && s.photos.length > 0 && !s.instagramPublished);
  const incompleteN = _slots.filter(s => !s.instagramPublished && (s.status !== 'done' || !s.photos.length)).length;

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
    ? `<div style="font-size:11px;color:var(--text3);margin-bottom:14px;">미완료 ${incompleteN}개 있어요 · <button onclick="showTab('tab-ai-suggest',document.querySelectorAll('.nav-btn')[0]); initAiRecommendTab();" style="background:transparent;border:none;color:var(--accent2);font-size:11px;font-weight:700;cursor:pointer;padding:0;">AI추천에서 확인 →</button></div>`
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
    const visPhotos = slot.photos.filter(p => !p.hidden);
    const thumbs = (visPhotos.length ? visPhotos : slot.photos).slice(0, 2).map(p =>
      `<img src="${p.editedDataUrl || p.dataUrl}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;">`
    ).join('');
    const cap = slot.caption
      ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${slot.caption.slice(0, 60)}${slot.caption.length > 60 ? '…' : ''}</div>`
      : '';
    const isDeferred = !!slot.deferredAt;
    return `
      <div data-finish-slot="${slot.id}" style="background:#fff;border:1.5px solid ${isDeferred ? 'rgba(255,193,7,0.4)' : 'rgba(76,175,80,0.3)'};border-radius:16px;padding:14px;margin-bottom:10px;">
        <!-- 슬롯 정보 -->
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">
          <div style="display:flex;gap:4px;">${thumbs}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <div style="font-size:13px;font-weight:800;color:var(--text);">${slot.label} ✅</div>
              ${slot.caption ? '<span style="font-size:9px;background:rgba(76,175,80,0.15);color:#388e3c;border-radius:4px;padding:1px 5px;font-weight:700;">캡션✓</span>' : ''}
              ${isDeferred ? '<span style="font-size:9px;background:rgba(255,193,7,0.15);color:#f57c00;border-radius:4px;padding:1px 5px;font-weight:700;">나중에</span>' : ''}
            </div>
            <div style="font-size:11px;color:var(--text3);">${visPhotos.length}장</div>
            ${cap}
          </div>
          <button onclick="openSlotPopup('${slot.id}')" style="flex-shrink:0;padding:6px 12px;border-radius:10px;border:1px solid var(--border);background:transparent;font-size:11px;color:var(--text2);cursor:pointer;font-weight:600;">편집</button>
        </div>
        <!-- 5가지 선택지 -->
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button onclick="publishSlotToInstagram('${slot.id}')" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:13px;font-weight:800;cursor:pointer;">📸 인스타에 올리기</button>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <button onclick="_saveSlotToGallery('${slot.id}')" style="padding:10px;border-radius:10px;border:1.5px solid rgba(241,128,145,0.3);background:transparent;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;">📁 갤러리에만 보관</button>
            <button onclick="downloadSlotPhotos('${slot.id}')" style="padding:10px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text2);font-size:11px;font-weight:700;cursor:pointer;">📥 내 폰에 저장</button>
          </div>
          <div style="display:flex;gap:6px;">
            <button onclick="_deferSlot('${slot.id}')" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid rgba(255,193,7,0.5);background:transparent;color:#f57c00;font-size:11px;font-weight:700;cursor:pointer;">🕐 나중에</button>
            <button onclick="deleteSlotFinish('${slot.id}')" style="padding:8px 14px;border-radius:10px;border:1.5px solid rgba(220,53,69,0.3);background:transparent;color:#dc3545;font-size:11px;cursor:pointer;font-weight:600;">삭제</button>
            <button onclick="showToast('슬롯이 유지돼요 🌸')" style="padding:8px 14px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text3);font-size:11px;cursor:pointer;">취소</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 갤러리 섹션
  const galleryHtml = galleryItems.length ? (() => {
    // 날짜별 그룹
    const byDate = {};
    galleryItems.forEach(item => {
      const d = item.date || '날짜 없음';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(item);
    });
    const dateHtml = Object.entries(byDate).map(([date, items]) => `
      <div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;">${date}</div>
        <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;">
          ${items.map(item => {
            const thumb = item.photos?.[0];
            return thumb ? `
              <div style="flex-shrink:0;width:80px;cursor:pointer;" onclick="_galleryItemDetail('${item.id}')">
                <div style="position:relative;width:80px;height:80px;border-radius:10px;overflow:hidden;">
                  <img src="${thumb.dataUrl}" style="width:100%;height:100%;object-fit:cover;">
                  ${item.photos.length > 1 ? `<div style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.55);border-radius:4px;padding:1px 4px;font-size:9px;color:#fff;">+${item.photos.length}</div>` : ''}
                </div>
                <div style="font-size:9px;color:var(--text2);margin-top:3px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.label}</div>
              </div>
            ` : '';
          }).join('')}
        </div>
      </div>
    `).join('');
    return `
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:12px;">갤러리 📁 <span style="font-size:11px;color:var(--text3);font-weight:400;">${galleryItems.length}개</span></div>
        ${dateHtml}
      </div>`;
  })() : '';

  root.innerHTML = `
    <div class="sec-title" style="margin-bottom:4px;">마무리 🎀</div>
    ${incompleteHtml}
    <div class="sec-sub" style="margin-bottom:16px;">완료 ${doneSlots.length}개 · 원하는 방법으로 마무리하세요</div>
    ${slotsHtml}
    ${galleryHtml}
  `;
}

function _galleryItemDetail(galleryId) {
  loadGalleryItems().then(items => {
    const item = items.find(i => i.id === galleryId);
    if (!item) return;
    const photos = item.photos || [];
    let pop = document.getElementById('_galleryDetailPop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = '_galleryDetailPop';
      pop.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;';
      pop.onclick = e => { if (e.target === pop) pop.style.display = 'none'; };
      document.body.appendChild(pop);
    }
    const escapedCaption = (item.caption || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    pop.innerHTML = `
      <div style="width:100%;max-width:480px;background:#fff;border-radius:20px 20px 0 0;max-height:90vh;overflow-y:auto;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-size:14px;font-weight:800;">${item.label} <span style="font-size:11px;color:var(--text3);font-weight:400;">${item.date}</span></div>
          <button onclick="document.getElementById('_galleryDetailPop').style.display='none'" style="background:transparent;border:none;font-size:20px;color:#aaa;cursor:pointer;">×</button>
        </div>
        ${_buildPeekCarousel(photos, 'gd_carousel')}
        ${escapedCaption ? `<div style="margin-top:12px;font-size:13px;color:#333;white-space:pre-wrap;line-height:1.6;">${escapedCaption}</div>` : ''}
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
          <button onclick="_republishGalleryItem('${item.id}')" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:13px;font-weight:800;cursor:pointer;">📸 다시 올리기</button>
          <div style="display:flex;gap:8px;">
            <button onclick="downloadGalleryItem('${item.id}')" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid var(--border);background:transparent;font-size:12px;color:var(--text2);cursor:pointer;font-weight:600;">📥 저장</button>
            <button onclick="deleteGalleryItem('${item.id}').then(()=>{document.getElementById('_galleryDetailPop').style.display='none';initFinishTab();})" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid rgba(220,53,69,0.3);background:transparent;font-size:12px;color:#dc3545;cursor:pointer;">삭제</button>
          </div>
        </div>
      </div>
    `;
    pop.style.display = 'flex';
    setTimeout(() => _initPeekCarousel('gd_carousel', photos.length), 80);
  });
}

async function _republishGalleryItem(galleryId) {
  const items = await loadGalleryItems();
  const item = items.find(i => i.id === galleryId);
  if (!item?.photos?.length) { showToast('사진이 없어요'); return; }
  const photo = item.photos[0];
  const fullCaption = (item.caption || '') + (item.hashtags ? '\n\n' + item.hashtags : '');
  const pop = document.getElementById('_galleryDetailPop');
  if (pop) pop.style.display = 'none';
  try {
    const blob = _dataUrlToBlob(photo.editedDataUrl || photo.dataUrl);
    const fd = new FormData();
    fd.append('image', blob, 'gallery_photo.jpg');
    fd.append('photo_type', 'after');
    fd.append('main_tag', item.label || '');
    const upRes = await fetch(API + '/portfolio', { method: 'POST', headers: authHeader(), body: fd });
    if (!upRes.ok) { showToast('업로드 실패'); return; }
    const upData = await upRes.json();
    const imgUrl = upData.image_url?.startsWith('http') ? upData.image_url : API + (upData.image_url || '');
    if (typeof doInstagramPublish === 'function') {
      const success = await doInstagramPublish(imgUrl, fullCaption);
      if (success) showToast('다시 업로드 완료! ✨');
    }
  } catch(e) { showToast('오류: ' + e.message); }
}

async function downloadGalleryItem(galleryId) {
  const items = await loadGalleryItems();
  const item = items.find(i => i.id === galleryId);
  if (!item?.photos?.length) { showToast('사진이 없어요'); return; }
  item.photos.forEach((p, i) => {
    const a = document.createElement('a');
    a.download = `itdasy_${item.label || 'gallery'}_${i + 1}_${Date.now()}.jpg`;
    a.href = p.editedDataUrl || p.dataUrl;
    a.click();
  });
  showToast('사진 저장 중... 📥');
}

async function _saveSlotToGallery(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot) return;
  try {
    await saveToGallery(slot);
    showToast('갤러리에 보관됐어요 📁');
    initFinishTab();
    // AI 추천 탭이 열려있으면 갱신
    const aiTab = document.getElementById('tab-ai-suggest');
    if (aiTab && aiTab.classList.contains('active') && typeof initAiRecommendTab === 'function') {
      initAiRecommendTab();
    }
  } catch(e) { showToast('저장 실패: ' + e.message); }
}

async function publishSlotToInstagram(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot?.photos.length) { showToast('사진이 없어요'); return; }
  const visPhotos = slot.photos.filter(p => !p.hidden);
  const photo = visPhotos[0] || slot.photos[0];
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
      const success = await doInstagramPublish(imgUrl, fullCaption);
      if (success) {
        slot.instagramPublished = true;
        slot.deferredAt = null;
        await saveSlotToDB(slot);
        // 갤러리 자동 저장
        try { await saveToGallery(slot); } catch(_e) {}
        initFinishTab();
      }
    }
  } catch(e) { showToast('오류: ' + e.message); }
}

async function _deferSlot(slotId) {
  const slot = _slots.find(s => s.id === slotId);
  if (!slot) return;
  slot.deferredAt = Date.now();
  try { await saveSlotToDB(slot); } catch(_e) {}
  showToast('AI 추천 탭에서 다시 볼 수 있어요 🕐');
  initFinishTab();
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
  await _renumberSlots();
  initFinishTab();
}
