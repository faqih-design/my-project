const engine = window.NameLayoutEngine;
const SVG_NS = 'http://www.w3.org/2000/svg';
const CM_TO_PREVIEW_PX = 18;
const STORAGE_KEY = 'name-layout-generator-project-v1';

let project = engine.createProject();
let undoStack = [];
let redoStack = [];
let dragState = null;
let privateUnlocked = false;

const $ = (id) => document.getElementById(id);
const inputs = {
  kode: $('kodeInput'), tanggal: $('tanggalInput'), ruko: $('rukoInput'), pengiriman: $('pengirimanInput'),
  headerMode: $('headerModeInput'), resi: $('resiInput'), name: $('nameInput'), dpi: $('dpiInput'),
  textC: $('textC'), textM: $('textM'), textY: $('textY'), textK: $('textK'), outlineK: $('outlineK'),
  outlineOpacity: $('outlineOpacity'), outlineMode: $('outlineMode'), outlineMin: $('outlineMin'), outlineMax: $('outlineMax'),
  font: $('fontInput'), headerFont: $('headerFontInput'), headerSize: $('headerSizeInput'), letterSpacing: $('letterSpacingInput'),
  privateMode: $('privateModeInput'), privateLimit: $('privateLimitInput'), search: $('searchInput')
};

function snapshot() {
  undoStack.push(JSON.stringify(project));
  redoStack = [];
}

function restore(serialized) {
  project = JSON.parse(serialized);
  render();
}

function syncSettingsFromControls() {
  Object.assign(project.settings, {
    dpi: Number(inputs.dpi.value),
    textColor: { c: Number(inputs.textC.value), m: Number(inputs.textM.value), y: Number(inputs.textY.value), k: Number(inputs.textK.value) },
    outlineColor: { c: 0, m: 0, y: 0, k: Number(inputs.outlineK.value) },
    outlineOpacity: Number(inputs.outlineOpacity.value),
    outlineMode: inputs.outlineMode.value,
    outlineMinCm: Number(inputs.outlineMin.value),
    outlineMaxCm: Number(inputs.outlineMax.value),
    fontFamily: inputs.font.value,
    headerFontFamily: inputs.headerFont.value,
    headerFontSizeCm: Number(inputs.headerSize.value),
    headerLetterSpacingCm: Number(inputs.letterSpacing.value),
    privateMode: inputs.privateMode.checked,
    privateMaxGroups: inputs.privateLimit.value ? Number(inputs.privateLimit.value) : null
  });
}

function getHeaderParts() {
  return {
    kode: inputs.kode.value,
    ruko: inputs.ruko.value,
    pengiriman: inputs.pengiriman.value,
    tanggal: inputs.tanggal.value
  };
}

function addSvg(parent, tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
  parent.appendChild(node);
  return node;
}

function drawText(parent, text, attrs) {
  const node = addSvg(parent, 'text', attrs);
  node.textContent = text;
  return node;
}

function render() {
  if (!privateUnlocked) {
    inputs.privateMode.checked = false;
    inputs.privateLimit.value = '';
  }
  syncSettingsFromControls();
  const layout = engine.computeProjectLayout(project);
  const svg = $('previewCanvas');
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${layout.widthCm} ${layout.heightCm}`);
  svg.setAttribute('width', layout.widthCm * CM_TO_PREVIEW_PX);
  svg.setAttribute('height', layout.heightCm * CM_TO_PREVIEW_PX);

  addSvg(svg, 'rect', { x: 0, y: 0, width: layout.widthCm, height: layout.heightCm, class: 'canvas-border' });

  const textFill = engine.cmykToCss(project.settings.textColor);
  const outline = engine.cmykToCss(project.settings.outlineColor);
  const query = inputs.search.value.trim().toUpperCase();

  layout.groups.forEach((group, groupIndex) => {
    const groupNode = addSvg(svg, 'g', { transform: `translate(0 ${group.yOffsetCm})`, 'data-group': group.id });
    addSvg(groupNode, 'rect', { x: 0.15, y: 0.15, width: layout.widthCm - 0.3, height: group.heightCm - 0.3, class: 'group-guide' });
    project.settings.columnPositionsCm.forEach((x, index) => {
      drawText(groupNode, `Kolom ${index + 1}`, { x, y: project.settings.headerHeightCm + project.settings.headerSpacingCm - 0.35, class: 'column-label' });
    });

    const headerFontSize = getHeaderSize(group.header, project.settings);
    const headerClass = query && group.header.includes(query) ? 'header-text highlight' : 'header-text';
    drawText(groupNode, group.header, {
      x: layout.widthCm / 2,
      y: 0.55,
      class: headerClass,
      fill: textFill,
      stroke: outline,
      'stroke-opacity': project.settings.outlineOpacity,
      'stroke-width': 0.045,
      'font-family': project.settings.headerFontFamily,
      'font-size': headerFontSize,
      'font-weight': project.settings.headerBold ? '800' : '400',
      'letter-spacing': project.settings.headerLetterSpacingCm
    });

    group.positions.forEach((item, index) => {
      const isMatch = query && (item.value.includes(query) || item.resiId.toUpperCase().includes(query));
      const text = drawText(groupNode, item.value, {
        x: item.xCm,
        y: project.settings.headerHeightCm + project.settings.headerSpacingCm + item.yCm,
        class: isMatch ? 'name-text highlight' : 'name-text',
        fill: textFill,
        stroke: outline,
        'stroke-opacity': project.settings.outlineOpacity,
        'stroke-width': item.outlineCm,
        'font-family': project.settings.fontFamily,
        'font-size': item.sizeCm * 0.45,
        'font-weight': 900,
        'data-group-index': groupIndex,
        'data-item-index': index
      });
      text.addEventListener('pointerdown', startDrag);
    });
  });

  updateCounters(layout);
  runSearch(layout);
  autoSave();
}

function getHeaderSize(header, settings) {
  const estimatedWidth = header.length * settings.headerFontSizeCm * 0.62;
  if (estimatedWidth <= settings.canvasWidthCm - 2) return settings.headerFontSizeCm;
  return Math.max(0.45, Number(((settings.canvasWidthCm - 2) / (header.length * 0.62)).toFixed(2)));
}

function updateCounters(layout) {
  const limit = engine.getEffectiveMaxGroups(project.settings);
  $('groupCounter').textContent = `${project.groups.length} / ${Number.isFinite(limit) ? limit : '∞'}`;
  const estimate = engine.estimateArea(project);
  $('statsOutput').innerHTML = `Nama: <strong>${estimate.nameCount}</strong><br>Grup: <strong>${estimate.groupCount}</strong><br>Estimasi area: <strong>${estimate.areaCm2} cm²</strong><br>Canvas: <strong>${layout.widthCm} × ${layout.heightCm.toFixed(2)} cm</strong>`;
}

function showWarning(message) {
  const warning = $('limitWarning');
  warning.textContent = message;
  warning.hidden = !message;
}

function addCurrentNames() {
  const names = inputs.name.value.split(/\r?\n/).map(engine.normalizeName).filter(Boolean);
  if (names.length === 0) return;
  snapshot();
  const result = engine.addResi(project, inputs.resi.value, names, getHeaderParts());
  showWarning(result.ok ? '' : result.warning);
  if (result.ok) {
    inputs.name.value = '';
    inputs.resi.value = incrementResi(inputs.resi.value);
  }
  render();
}

function incrementResi(value) {
  const match = String(value).match(/(.*?)(\d+)$/);
  if (!match) return value;
  const next = String(Number(match[2]) + 1).padStart(match[2].length, '0');
  return `${match[1]}${next}`;
}

function addNewGroup() {
  snapshot();
  const result = engine.addGroup(project, getHeaderParts(), inputs.headerMode.value);
  showWarning(result.ok ? '' : result.warning);
  render();
}

function finishCurrentGroup() {
  const group = project.groups[project.groups.length - 1];
  if (!group) return;
  snapshot();
  engine.finishGroup(group);
  render();
}

function runSearch(layout) {
  const query = inputs.search.value.trim().toUpperCase();
  if (!query) {
    $('searchResults').textContent = 'Cari nama, resi, kode, atau ruko.';
    return;
  }
  const matches = [];
  layout.groups.forEach((group) => {
    if (group.header.includes(query)) matches.push(`Header: ${group.header}`);
    group.positions.forEach((item) => {
      if (item.value.includes(query) || item.resiId.toUpperCase().includes(query)) matches.push(`${item.value} (${item.resiId})`);
    });
  });
  $('searchResults').innerHTML = matches.length ? matches.slice(0, 20).join('<br>') : 'Tidak ada hasil.';
}

function autoSave() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

function loadSavedProject() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) project = JSON.parse(saved);
}

function saveProject() {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `name-layout-project-${Date.now()}.json`);
}

function exportPng() {
  const layout = engine.computeProjectLayout(project);
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString($('previewCanvas'));
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();
  const dpi = Number(inputs.dpi.value);
  const widthPx = Math.round(layout.widthCm / 2.54 * dpi);
  const heightPx = Math.round(layout.heightCm / 2.54 * dpi);
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, widthPx, heightPx);
    context.drawImage(image, 0, 0, widthPx, heightPx);
    canvas.toBlob((blob) => {
      downloadBlob(blob, `name-layout-${dpi}dpi.png`);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  image.src = url;
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function startDrag(event) {
  dragState = { target: event.currentTarget, startX: event.clientX, startY: event.clientY, x: Number(event.currentTarget.getAttribute('x')), y: Number(event.currentTarget.getAttribute('y')) };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function handleDrag(event) {
  if (!dragState) return;
  const dx = (event.clientX - dragState.startX) / CM_TO_PREVIEW_PX;
  const dy = (event.clientY - dragState.startY) / CM_TO_PREVIEW_PX;
  dragState.target.setAttribute('x', dragState.x + dx);
  dragState.target.setAttribute('y', dragState.y + dy);
}

function stopDrag() { dragState = null; }

function unlockPrivateMode() {
  const password = window.prompt('Masukkan password owner untuk Private Unlock Mode');
  if (password !== 'OWNER') {
    showWarning('Password private mode salah.');
    return;
  }
  privateUnlocked = true;
  inputs.privateMode.disabled = false;
  inputs.privateLimit.disabled = false;
  inputs.privateMode.checked = true;
  $('privateHint').textContent = 'Private mode terbuka untuk owner/admin.';
  showWarning('');
  render();
}

function bindEvents() {
  $('addNamesButton').addEventListener('click', addCurrentNames);
  $('newGroupButton').addEventListener('click', addNewGroup);
  $('finishGroupButton').addEventListener('click', finishCurrentGroup);
  $('saveButton').addEventListener('click', saveProject);
  $('exportButton').addEventListener('click', exportPng);
  Object.values(inputs).forEach((input) => input.addEventListener('input', render));
  inputs.name.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      addCurrentNames();
    }
  });
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (event.key === 'F1') { event.preventDefault(); finishCurrentGroup(); }
    if (event.ctrlKey && event.shiftKey && key === 'u') { event.preventDefault(); unlockPrivateMode(); return; }
    if (!event.ctrlKey) return;
    if (key === 's') { event.preventDefault(); saveProject(); }
    if (key === 'e') { event.preventDefault(); exportPng(); }
    if (key === 'f') { event.preventDefault(); inputs.search.focus(); }
    if (key === 'z' && undoStack.length) { event.preventDefault(); redoStack.push(JSON.stringify(project)); restore(undoStack.pop()); }
    if (key === 'y' && redoStack.length) { event.preventDefault(); undoStack.push(JSON.stringify(project)); restore(redoStack.pop()); }
  });
  window.addEventListener('pointermove', handleDrag);
  window.addEventListener('pointerup', stopDrag);
}

loadSavedProject();
bindEvents();
if (project.groups.length === 0) {
  engine.addGroup(project, getHeaderParts(), 'KODE BARU');
}
render();
