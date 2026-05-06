const engine = window.NameLayoutEngine;
const SVG_NS = 'http://www.w3.org/2000/svg';
const PREVIEW_PX_PER_CM = 8;
const MIN_PREVIEW_STROKE_PX = 0.5;
const MAX_PREVIEW_OUTLINE_PX = 1.25;
const STORAGE_KEY = 'name-layout-generator-project-v1';
const RECENT_COLORS_KEY = 'name-layout-generator-recent-colors-v1';
const PRESET_COLORS = ['#000000', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#2563eb', '#7c3aed', '#ec4899'];

let project = engine.createProject();
let undoStack = [];
let redoStack = [];
let dragState = null;
let privateUnlocked = false;
let zoomScale = 1;
let recentColors = { text: [], outline: [] };

const $ = (id) => document.getElementById(id);
const inputs = {
  kode: $('kodeInput'), tanggal: $('tanggalInput'), ruko: $('rukoInput'), pengiriman: $('pengirimanInput'),
  headerMode: $('headerModeInput'), resi: $('resiInput'), name: $('nameInput'), dpi: $('dpiInput'),
  textColor: $('textColorPicker'), outlineColor: $('outlineColorPicker'),
  textC: $('textC'), textM: $('textM'), textY: $('textY'), textK: $('textK'), outlineC: $('outlineC'), outlineM: $('outlineM'), outlineY: $('outlineY'), outlineK: $('outlineK'),
  outlineOpacity: $('outlineOpacity'), outlineMode: $('outlineMode'), outlineMin: $('outlineMin'), outlineMax: $('outlineMax'),
  font: $('fontInput'), headerFont: $('headerFontInput'), headerSize: $('headerSizeInput'), letterSpacing: $('letterSpacingInput'),
  debugOverlay: $('debugOverlayInput'), privateMode: $('privateModeInput'), privateLimit: $('privateLimitInput'), search: $('searchInput')
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
    textColor: engine.hexToCmyk(inputs.textColor.value),
    outlineColor: engine.hexToCmyk(inputs.outlineColor.value),
    outlineOpacity: Number(inputs.outlineOpacity.value),
    outlineMode: inputs.outlineMode.value,
    outlineMinCm: Number(inputs.outlineMin.value),
    outlineMaxCm: Number(inputs.outlineMax.value),
    fontFamily: inputs.font.value,
    headerFontFamily: inputs.headerFont.value,
    headerFontSizeCm: Number(inputs.headerSize.value),
    headerLetterSpacingCm: Number(inputs.letterSpacing.value),
    debugOverlay: inputs.debugOverlay.checked,
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

function updateCmykReadout(target, cmyk) {
  inputs[`${target}C`].value = cmyk.c;
  inputs[`${target}M`].value = cmyk.m;
  inputs[`${target}Y`].value = cmyk.y;
  inputs[`${target}K`].value = cmyk.k;
}

function updateColorPreviews() {
  const textHex = inputs.textColor.value;
  const outlineHex = inputs.outlineColor.value;
  const textCmyk = engine.hexToCmyk(textHex);
  const outlineCmyk = engine.hexToCmyk(outlineHex);
  updateCmykReadout('text', textCmyk);
  updateCmykReadout('outline', outlineCmyk);
  $('textColorPreview').style.background = textHex;
  $('textColorPreview').style.color = getReadableTextColor(textHex);
  $('outlineColorPreview').style.background = outlineHex;
  $('outlineColorPreview').style.color = getReadableTextColor(outlineHex);
  $('outlineColorPreview').style.borderColor = textHex;
}

function getReadableTextColor(hex) {
  const rgb = engine.hexToRgb(hex);
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.58 ? '#111827' : '#ffffff';
}

function setPickerColor(target, hex, remember) {
  inputs[target === 'text' ? 'textColor' : 'outlineColor'].value = hex.toLowerCase();
  if (remember) rememberRecentColor(target, hex);
  render();
}

function rememberRecentColor(target, hex) {
  const normalized = hex.toLowerCase();
  recentColors[target] = [normalized, ...recentColors[target].filter((color) => color !== normalized)].slice(0, 8);
  localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(recentColors));
  renderColorSwatches();
}

function loadRecentColors() {
  const saved = localStorage.getItem(RECENT_COLORS_KEY);
  if (saved) recentColors = Object.assign({ text: [], outline: [] }, JSON.parse(saved));
}

function renderColorSwatches() {
  renderSwatchSet('textPresetColors', 'text', PRESET_COLORS, 'Preset');
  renderSwatchSet('outlinePresetColors', 'outline', PRESET_COLORS, 'Preset');
  renderSwatchSet('textRecentColors', 'text', recentColors.text, 'Recent');
  renderSwatchSet('outlineRecentColors', 'outline', recentColors.outline, 'Recent');
}

function renderSwatchSet(containerId, target, colors, label) {
  const container = $(containerId);
  container.innerHTML = '';
  colors.forEach((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-swatch';
    button.style.background = color;
    button.title = `${label} ${target}: ${color}`;
    button.setAttribute('aria-label', `${label} ${target} ${color}`);
    button.addEventListener('click', () => setPickerColor(target, color, true));
    container.appendChild(button);
  });
}

function initColorControlsFromProject() {
  inputs.textColor.value = engine.cmykToHex(project.settings.textColor);
  inputs.outlineColor.value = engine.cmykToHex(project.settings.outlineColor);
  updateColorPreviews();
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
function cmToPreviewPx(valueCm) {
  return Number((valueCm * PREVIEW_PX_PER_CM).toFixed(3));
}

function previewOutlinePx(outlineCm) {
  return Number(Math.min(MAX_PREVIEW_OUTLINE_PX, Math.max(MIN_PREVIEW_STROKE_PX, cmToPreviewPx(outlineCm))).toFixed(3));
}

function debugText(parent, text, xCm, yCm) {
  return drawText(parent, text, {
    x: cmToPreviewPx(xCm),
    y: cmToPreviewPx(yCm),
    class: 'debug-text',
    'font-family': 'ui-monospace, SFMono-Regular, Consolas, monospace',
    'font-size': 9,
    fill: '#0f766e'
  });
}


function setSvgDimensions(svg, layout, scale) {
  const renderScale = scale || 1;
  const previewWidthPx = cmToPreviewPx(layout.widthCm);
  const previewHeightPx = cmToPreviewPx(layout.heightCm);
  svg.innerHTML = '';
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${previewWidthPx} ${previewHeightPx}`);
  svg.setAttribute('width', previewWidthPx * renderScale);
  svg.setAttribute('height', previewHeightPx * renderScale);
  svg.dataset.previewScale = `${PREVIEW_PX_PER_CM} px/cm`;
}

function renderLayoutSvg(svg, layout, options) {
  const renderOptions = Object.assign({ interactive: false, debug: project.settings.debugOverlay }, options || {});
  setSvgDimensions(svg, layout, renderOptions.scale);
  addSvg(svg, 'rect', {
    x: 0,
    y: 0,
    width: cmToPreviewPx(layout.widthCm),
    height: cmToPreviewPx(layout.heightCm),
    class: 'canvas-border',
    fill: 'transparent',
    stroke: '#94a3b8',
    'stroke-width': 1
  });

  const textFill = engine.cmykToCss(project.settings.textColor);
  const outline = engine.cmykToCss(project.settings.outlineColor);
  const query = inputs.search.value.trim().toUpperCase();

  layout.groups.forEach((group, groupIndex) => {
    const groupNode = addSvg(svg, 'g', { transform: `translate(0 ${cmToPreviewPx(group.yOffsetCm)})`, 'data-group': group.id });
    drawGroupGuides(groupNode, layout, group);
    drawHeader(groupNode, group, textFill, outline, query);
    if (renderOptions.debug) drawHeaderDebug(groupNode, group.headerObject);
    group.positions.forEach((item, index) => {
      const text = drawName(groupNode, item, groupIndex, index, textFill, outline, query);
      if (renderOptions.interactive) text.addEventListener('pointerdown', startDrag);
      if (renderOptions.debug) drawNameDebug(groupNode, item);
    });
    if (renderOptions.debug) drawGroupDebug(groupNode, group);
  });
}

function drawGroupGuides(groupNode, layout, group) {
  addSvg(groupNode, 'rect', {
    x: cmToPreviewPx(0.15),
    y: cmToPreviewPx(0.15),
    width: cmToPreviewPx(layout.widthCm - 0.3),
    height: cmToPreviewPx(group.heightCm - 0.3),
    class: 'group-guide',
    fill: 'rgba(255,255,255,.72)',
    stroke: '#cbd5e1',
    'stroke-dasharray': '4 3',
    'stroke-width': 1
  });
  project.settings.columnPositionsCm.forEach((x, index) => {
    addSvg(groupNode, 'line', {
      x1: cmToPreviewPx(x),
      x2: cmToPreviewPx(x),
      y1: cmToPreviewPx(project.settings.headerHeightCm + project.settings.headerSpacingCm),
      y2: cmToPreviewPx(project.settings.headerHeightCm + project.settings.headerSpacingCm + project.settings.columnMaxHeightCm),
      class: 'column-line',
      stroke: 'rgba(14, 116, 144, .32)',
      'stroke-width': 1,
      'stroke-dasharray': '3 5'
    });
    drawText(groupNode, `Kolom ${index + 1}`, {
      x: cmToPreviewPx(x),
      y: cmToPreviewPx(project.settings.headerHeightCm + project.settings.headerSpacingCm - 0.35),
      class: 'column-label',
      'font-size': 8,
      fill: '#64748b'
    });
  });
}

function drawHeader(groupNode, group, textFill, outline, query) {
  const header = group.headerObject;
  const isMatch = query && header.value.includes(query);
  drawText(groupNode, header.value, {
    x: cmToPreviewPx(header.centerXCm),
    y: cmToPreviewPx(header.yCm),
    class: isMatch ? 'header-text highlight' : 'header-text',
    'dominant-baseline': 'hanging',
    'text-anchor': 'middle',
    'paint-order': 'stroke fill',
    fill: textFill,
    stroke: outline,
    'stroke-opacity': project.settings.outlineOpacity,
    'stroke-width': previewOutlinePx(header.outlineCm),
    'font-family': project.settings.headerFontFamily,
    'font-size': cmToPreviewPx(header.fontSizeCm),
    'font-weight': project.settings.headerBold ? '800' : '400',
    'letter-spacing': cmToPreviewPx(project.settings.headerLetterSpacingCm)
  });
}

function drawName(groupNode, item, groupIndex, index, textFill, outline, query) {
  const isMatch = query && (item.value.includes(query) || item.resiId.toUpperCase().includes(query));
  return drawText(groupNode, item.value, {
    x: cmToPreviewPx(item.xCm),
    y: cmToPreviewPx(project.settings.headerHeightCm + project.settings.headerSpacingCm + item.yCm),
    class: isMatch ? 'name-text highlight' : 'name-text',
    'dominant-baseline': 'hanging',
    'paint-order': 'stroke fill',
    fill: textFill,
    stroke: outline,
    'stroke-opacity': project.settings.outlineOpacity,
    'stroke-width': previewOutlinePx(item.outlineSizeCm),
    'font-family': project.settings.fontFamily,
    'font-size': cmToPreviewPx(item.fontSizeCm),
    'font-weight': 900,
    'data-group-index': groupIndex,
    'data-item-index': index
  });
}

function render() {
  if (!privateUnlocked) {
    inputs.privateMode.checked = false;
    inputs.privateLimit.value = '';
  }
  syncSettingsFromControls();
  updateColorPreviews();
  const layout = engine.computeProjectLayout(project);
  renderLayoutSvg($('previewCanvas'), layout, { interactive: true, debug: project.settings.debugOverlay, scale: zoomScale });
  updateWorkspaceScale(layout);
  updateCounters(layout);
  runSearch(layout);
  autoSave();
}


function drawHeaderDebug(groupNode, header) {
  addSvg(groupNode, 'rect', {
    x: cmToPreviewPx(header.boundingBox.xCm),
    y: cmToPreviewPx(header.boundingBox.yCm),
    width: cmToPreviewPx(header.boundingBox.widthCm),
    height: cmToPreviewPx(header.boundingBox.heightCm),
    class: 'debug-box',
    fill: 'rgba(20, 184, 166, .06)',
    stroke: 'rgba(13, 148, 136, .72)',
    'stroke-width': 1,
    'stroke-dasharray': '2 2'
  });
  debugText(groupNode, `HEADER x:${header.xCm.toFixed(1)} y:${header.yCm.toFixed(1)} h:${header.heightCm}`, header.xCm, header.yCm + header.heightCm + 0.25);
}

function drawNameDebug(groupNode, item) {
  const topCm = project.settings.headerHeightCm + project.settings.headerSpacingCm + item.yCm;
  const box = item.boundingBox;
  addSvg(groupNode, 'rect', {
    x: cmToPreviewPx(box.xCm),
    y: cmToPreviewPx(project.settings.headerHeightCm + project.settings.headerSpacingCm + box.yCm),
    width: cmToPreviewPx(box.widthCm),
    height: cmToPreviewPx(box.heightCm),
    class: 'debug-box',
    fill: 'rgba(20, 184, 166, .06)',
    stroke: 'rgba(13, 148, 136, .72)',
    'stroke-width': 1,
    'stroke-dasharray': '2 2'
  });
  debugText(groupNode, `x:${item.xCm.toFixed(1)} y:${item.yCm.toFixed(1)} h:${item.heightCm} o:${item.outlineSizeCm}`, item.xCm, topCm + item.heightCm + 0.25);
}

function drawGroupDebug(groupNode, group) {
  group.columnHeightsCm.forEach((height, index) => {
    const x = project.settings.columnPositionsCm[index];
    debugText(groupNode, `H${index + 1}: ${height.toFixed(2)}cm`, x, project.settings.headerHeightCm + project.settings.headerSpacingCm + project.settings.columnMaxHeightCm + 0.45);
  });
}

function updateWorkspaceScale(layout) {
  $('zoomValue').textContent = `${Math.round(zoomScale * 100)}%`;
  $('canvasViewport').style.setProperty('--zoom', zoomScale);
  renderRulers(layout);
}

function renderRulers(layout) {
  renderTopRuler(layout.widthCm);
  renderLeftRuler(layout.heightCm);
}

function renderTopRuler(widthCm) {
  const ruler = $('topRuler');
  ruler.innerHTML = '';
  for (let cm = 0; cm <= Math.ceil(widthCm); cm += 5) {
    const mark = document.createElement('span');
    mark.className = 'ruler-mark';
    mark.style.left = `${cmToPreviewPx(cm) * zoomScale + 32}px`;
    mark.textContent = cm;
    ruler.appendChild(mark);
  }
}

function renderLeftRuler(heightCm) {
  const ruler = $('leftRuler');
  ruler.innerHTML = '';
  for (let cm = 0; cm <= Math.ceil(heightCm); cm += 5) {
    const mark = document.createElement('span');
    mark.className = 'ruler-mark';
    mark.style.top = `${cmToPreviewPx(cm) * zoomScale + 32}px`;
    mark.textContent = cm;
    ruler.appendChild(mark);
  }
}

function setZoom(nextZoom) {
  zoomScale = Math.min(2, Math.max(0.45, Number(nextZoom.toFixed(2))));
  render();
}

function undoProject() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(project));
  restore(undoStack.pop());
}

function redoProject() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(project));
  restore(redoStack.pop());
}

function togglePanel(side) {
  $('appShell').classList.toggle(`${side}-collapsed`);
  render();
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
  const exportSvg = document.createElementNS(SVG_NS, 'svg');
  renderLayoutSvg(exportSvg, layout, { interactive: false, debug: project.settings.debugOverlay, scale: 1 });
  const source = serializer.serializeToString(exportSvg);
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
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;
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
  $('undoButton').addEventListener('click', undoProject);
  $('redoButton').addEventListener('click', redoProject);
  $('zoomOutButton').addEventListener('click', () => setZoom(zoomScale - 0.1));
  $('zoomInButton').addEventListener('click', () => setZoom(zoomScale + 0.1));
  $('leftCollapseButton').addEventListener('click', () => togglePanel('left'));
  $('rightCollapseButton').addEventListener('click', () => togglePanel('right'));
  inputs.textColor.addEventListener('change', () => rememberRecentColor('text', inputs.textColor.value));
  inputs.outlineColor.addEventListener('change', () => rememberRecentColor('outline', inputs.outlineColor.value));
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
    if (key === 'z') { event.preventDefault(); undoProject(); }
    if (key === 'y') { event.preventDefault(); redoProject(); }
  });
  window.addEventListener('pointermove', handleDrag);
  window.addEventListener('pointerup', stopDrag);
}

loadSavedProject();
loadRecentColors();
initColorControlsFromProject();
renderColorSwatches();
bindEvents();
if (project.groups.length === 0) {
  engine.addGroup(project, getHeaderParts(), 'KODE BARU');
}
render();
