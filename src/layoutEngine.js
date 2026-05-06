(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NameLayoutEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_SETTINGS = Object.freeze({
    canvasWidthCm: 58,
    columnPositionsCm: [0.3, 14.5, 29, 45],
    columnMaxHeightCm: 50,
    nameSpacingCm: 0.7,
    headerSpacingCm: 1,
    groupGapCm: 2,
    maxGroups: 5,
    privateMode: false,
    privateMaxGroups: null,
    headerHeightCm: 2,
    textColor: { c: 0, m: 0, y: 0, k: 100 },
    outlineColor: { c: 0, m: 0, y: 0, k: 0 },
    outlineOpacity: 1,
    outlineMinCm: 0.04,
    outlineMaxCm: 0.15,
    outlineMode: 'auto',
    fontFamily: 'Arial Black, Impact, sans-serif',
    headerFontFamily: 'Arial, sans-serif',
    headerFontSizeCm: 1.15,
    headerLetterSpacingCm: 0.03,
    headerBold: true,
    debugOverlay: false,
    dpi: 300
  });

  const SIZE_RULES_CM = Object.freeze({
    5: { 0: 12 },
    4: { 0: 10, 1: 9, 2: 8, 3: 7, 4: 6 },
    3: { 0: 8, 1: 7, 2: 6, 3: 5 },
    2: { 0: 6, 1: 5, 2: 4 },
    1: { 0: 3, 1: 2 }
  });

  function normalizeName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function countLetters(name) {
    return normalizeName(name).replace(/[^A-Z0-9]/g, '').length;
  }

  function countI(name) {
    const match = normalizeName(name).match(/I/g);
    return match ? match.length : 0;
  }

  function getAutoSizeCm(name) {
    const normalized = normalizeName(name);
    const length = countLetters(normalized);
    const iCount = countI(normalized);
    if (length <= 0) return 0;
    if (length <= 5 && SIZE_RULES_CM[length] && SIZE_RULES_CM[length][iCount] !== undefined) {
      return SIZE_RULES_CM[length][iCount];
    }
    if (length === 5 && iCount === 0) return 12;
    const longNamePenalty = Math.max(0, length - 5) * 0.75;
    const thinLetterBonus = Math.min(iCount * 0.25, 1.5);
    return Math.max(3.5, Number((12 - longNamePenalty + thinLetterBonus).toFixed(2)));
  }

  function getWeightedTextLength(name) {
    return normalizeName(name)
      .replace(/[^A-Z0-9]/g, '')
      .split('')
      .reduce((total, character) => total + (character === 'I' ? 0.38 : 1), 0);
  }

  function getNameMetrics(name, settings) {
    const sizeCm = getAutoSizeCm(name);
    const outlineCm = getOutlineThicknessCm(sizeCm, settings);
    const weightedLength = Math.max(1, getWeightedTextLength(name));
    const fontSizeCm = Number(Math.min(4.2, Math.max(1.2, sizeCm / (weightedLength * 0.64))).toFixed(2));
    const textHeightCm = Number((fontSizeCm * 0.82).toFixed(2));
    const boxWidthCm = Number((sizeCm + outlineCm * 2).toFixed(2));
    const boxHeightCm = Number((textHeightCm + outlineCm * 2).toFixed(2));
    return {
      sizeCm,
      widthCm: sizeCm,
      textHeightCm,
      fontSizeCm,
      outlineCm,
      boxWidthCm,
      boxHeightCm,
      heightCm: textHeightCm
    };
  }

  function getNameHeightCm(name, settings) {
    return getNameMetrics(name, settings).heightCm;
  }

  function getOutlineThicknessCm(sizeCm, settings) {
    if (settings.outlineMode === 'manual') {
      return Number(Math.min(settings.outlineMaxCm, Math.max(settings.outlineMinCm, settings.outlineMaxCm)).toFixed(3));
    }
    return Number(Math.min(settings.outlineMaxCm, Math.max(settings.outlineMinCm, sizeCm * 0.008)).toFixed(3));
  }

  function getEffectiveMaxGroups(settings) {
    if (!settings.privateMode) return settings.maxGroups;
    return settings.privateMaxGroups || Number.POSITIVE_INFINITY;
  }

  function makeHeader(parts) {
    const safe = parts || {};
    return [safe.kode, safe.nomor, safe.ruko, safe.pengiriman, safe.tanggal]
      .filter(Boolean)
      .map((part) => String(part).trim().toUpperCase())
      .join(' ');
  }

  function getHeaderMetrics(header, settings) {
    const normalized = normalizeName(header);
    const estimatedWidth = normalized.length * settings.headerFontSizeCm * 0.62;
    const fontSizeCm = estimatedWidth <= settings.canvasWidthCm - 2
      ? settings.headerFontSizeCm
      : Math.max(0.45, Number(((settings.canvasWidthCm - 2) / (normalized.length * 0.62)).toFixed(2)));
    const widthCm = Number(Math.min(settings.canvasWidthCm - 2, normalized.length * fontSizeCm * 0.62).toFixed(2));
    const heightCm = Number((fontSizeCm * 1.05).toFixed(2));
    const outlineCm = 0.045;
    return {
      value: normalized,
      xCm: Number((settings.canvasWidthCm / 2 - widthCm / 2).toFixed(2)),
      yCm: 0.55,
      centerXCm: settings.canvasWidthCm / 2,
      widthCm,
      heightCm,
      fontSizeCm,
      outlineCm,
      boxWidthCm: Number((widthCm + outlineCm * 2).toFixed(2)),
      boxHeightCm: Number((heightCm + outlineCm * 2).toFixed(2)),
      outlineSizeCm: outlineCm,
      boundingBox: {
        xCm: Number((settings.canvasWidthCm / 2 - widthCm / 2 - outlineCm).toFixed(2)),
        yCm: Number((0.55 - outlineCm).toFixed(2)),
        widthCm: Number((widthCm + outlineCm * 2).toFixed(2)),
        heightCm: Number((heightCm + outlineCm * 2).toFixed(2))
      }
    };
  }

  function createProject(settings) {
    return {
      settings: Object.assign({}, DEFAULT_SETTINGS, settings || {}),
      groups: [],
      history: [],
      savedTemplates: [],
      nextNumberByCode: {}
    };
  }

  function nextHeaderNumber(project, code, mode) {
    const key = normalizeName(code || 'KODE');
    if (mode === 'KODE BARU' || !project.nextNumberByCode[key]) {
      project.nextNumberByCode[key] = 1;
    } else {
      project.nextNumberByCode[key] += 1;
    }
    return project.nextNumberByCode[key];
  }

  function addGroup(project, headerParts, mode) {
    const limit = getEffectiveMaxGroups(project.settings);
    if (project.groups.length >= limit) {
      return {
        ok: false,
        warning: 'Batas maksimal 5 kode tercapai. Silakan export project terlebih dahulu.'
      };
    }
    const parts = Object.assign({}, headerParts || {});
    parts.nomor = parts.nomor || nextHeaderNumber(project, parts.kode, mode || 'LANJUTKAN KODE');
    const group = {
      id: `group-${Date.now()}-${project.groups.length + 1}`,
      headerParts: parts,
      header: makeHeader(parts),
      resiBlocks: [],
      layoutMode: 'flow'
    };
    project.groups.push(group);
    return { ok: true, group };
  }

  function ensureGroup(project, headerParts) {
    if (project.groups.length === 0) {
      return addGroup(project, headerParts || { kode: 'KRUPUK', ruko: 'RESI RUKO 2', pengiriman: 'RBS', tanggal: '01' });
    }
    return { ok: true, group: project.groups[project.groups.length - 1] };
  }

  function getBlockHeightCm(block, settings) {
    return block.names.reduce((total, item, index) => {
      const spacing = index === 0 ? 0 : settings.nameSpacingCm;
      return total + item.heightCm + spacing;
    }, 0);
  }

  function makeResiBlock(resiId, names, settings) {
    const normalizedNames = names.map(normalizeName).filter(Boolean);
    return {
      id: resiId || `RESI-${Date.now()}`,
      createdAt: new Date().toISOString(),
      names: normalizedNames.map((name) => {
        const metrics = getNameMetrics(name, settings);
        return Object.assign({ value: name }, metrics);
      })
    };
  }

  function getColumnHeightsForGroup(group, settings) {
    return computeGroupLayout(group, settings).columnHeightsCm;
  }

  function canFitBlockInGroup(group, block, settings) {
    const heights = getColumnHeightsForGroup(group, settings);
    let column = 0;
    let currentHeight = heights[column] || 0;
    for (const item of block.names) {
      let itemHeight = item.heightCm + (currentHeight > 0 ? settings.nameSpacingCm : 0);
      if (currentHeight + itemHeight > settings.columnMaxHeightCm) {
        column += 1;
        currentHeight = 0;
        itemHeight = item.heightCm;
      }
      if (column >= settings.columnPositionsCm.length) return false;
      currentHeight += itemHeight;
    }
    return true;
  }

  function addResi(project, resiId, names, headerParts) {
    const current = ensureGroup(project, headerParts);
    if (!current.ok) return current;
    const block = makeResiBlock(resiId, Array.isArray(names) ? names : [names], project.settings);
    let targetGroup = current.group;
    if (!canFitBlockInGroup(targetGroup, block, project.settings)) {
      const nextHeader = Object.assign({}, targetGroup.headerParts, { nomor: undefined });
      const added = addGroup(project, nextHeader, 'LANJUTKAN KODE');
      if (!added.ok) return added;
      targetGroup = added.group;
    }
    targetGroup.resiBlocks.push(block);
    project.history.unshift({ resiId: block.id, names: block.names.map((name) => name.value), groupId: targetGroup.id, at: block.createdAt });
    return { ok: true, group: targetGroup, block };
  }

  function flattenNames(group) {
    return group.resiBlocks.flatMap((block) => block.names.map((name) => Object.assign({ resiId: block.id }, name)));
  }

  function toPositionedName(item, settings, column, yCm) {
    const xCm = settings.columnPositionsCm[column];
    return Object.assign({}, item, {
      xCm,
      yCm,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      outlineSizeCm: item.outlineCm,
      boundingBox: {
        xCm: Number((xCm - item.outlineCm).toFixed(2)),
        yCm: Number((yCm - item.outlineCm).toFixed(2)),
        widthCm: item.boxWidthCm,
        heightCm: item.boxHeightCm
      },
      column
    });
  }

  function computeFlowLayout(group, settings) {
    const positions = [];
    const columnHeights = new Array(settings.columnPositionsCm.length).fill(0);
    let column = 0;
    for (const item of flattenNames(group)) {
      if (column >= settings.columnPositionsCm.length) break;
      let y = columnHeights[column];
      const extraSpacing = y > 0 ? settings.nameSpacingCm : 0;
      if (y + extraSpacing + item.heightCm > settings.columnMaxHeightCm) {
        column += 1;
        if (column >= settings.columnPositionsCm.length) break;
        y = columnHeights[column];
      }
      const spacing = y > 0 ? settings.nameSpacingCm : 0;
      const placedY = y + spacing;
      positions.push(toPositionedName(item, settings, column, placedY));
      columnHeights[column] = placedY + item.heightCm;
    }
    return { positions, columnHeightsCm: columnHeights };
  }

  function computeBalancedLayout(group, settings) {
    const blocks = group.resiBlocks.map((block) => ({ block, height: getBlockHeightCm(block, settings) }));
    const columns = settings.columnPositionsCm.map(() => []);
    const heights = settings.columnPositionsCm.map(() => 0);
    let column = 0;
    const ideal = Math.max(1, blocks.reduce((sum, block) => sum + block.height, 0) / settings.columnPositionsCm.length);
    for (const entry of blocks) {
      if (column < columns.length - 1 && heights[column] > 0 && heights[column] + entry.height > ideal) {
        column += 1;
      }
      columns[column].push(entry.block);
      heights[column] += entry.height + (heights[column] > 0 ? settings.nameSpacingCm : 0);
    }
    const positions = [];
    const columnHeights = new Array(settings.columnPositionsCm.length).fill(0);
    columns.forEach((columnBlocks, columnIndex) => {
      for (const block of columnBlocks) {
        for (const item of block.names) {
          const spacing = columnHeights[columnIndex] > 0 ? settings.nameSpacingCm : 0;
          const y = columnHeights[columnIndex] + spacing;
          positions.push(toPositionedName(Object.assign({ resiId: block.id }, item), settings, columnIndex, y));
          columnHeights[columnIndex] = y + item.heightCm;
        }
      }
    });
    return { positions, columnHeightsCm: columnHeights };
  }

  function computeGroupLayout(group, settings) {
    return group.layoutMode === 'balanced'
      ? computeBalancedLayout(group, settings)
      : computeFlowLayout(group, settings);
  }

  function computeProjectLayout(project) {
    let yOffset = 0;
    const groups = project.groups.map((group) => {
      const layout = computeGroupLayout(group, project.settings);
      const contentHeight = Math.max(project.settings.columnMaxHeightCm, ...layout.columnHeightsCm);
      const totalHeight = project.settings.headerHeightCm + project.settings.headerSpacingCm + contentHeight;
      const headerObject = getHeaderMetrics(group.header, project.settings);
      const result = Object.assign({}, group, {
        yOffsetCm: yOffset,
        headerObject,
        positions: layout.positions,
        columnHeightsCm: layout.columnHeightsCm,
        heightCm: totalHeight
      });
      yOffset += totalHeight + project.settings.groupGapCm;
      return result;
    });
    return {
      widthCm: project.settings.canvasWidthCm,
      heightCm: Math.max(10, yOffset - project.settings.groupGapCm),
      groups
    };
  }

  function finishGroup(group) {
    group.layoutMode = 'balanced';
    return group;
  }

  function cmykToRgb(color) {
    const c = (color.c || 0) / 100;
    const m = (color.m || 0) / 100;
    const y = (color.y || 0) / 100;
    const k = (color.k || 0) / 100;
    return {
      r: Math.round(255 * (1 - c) * (1 - k)),
      g: Math.round(255 * (1 - m) * (1 - k)),
      b: Math.round(255 * (1 - y) * (1 - k))
    };
  }

  function cmykToCss(color) {
    const rgb = cmykToRgb(color);
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  }

  function rgbToCmyk(rgb) {
    const r = Math.min(255, Math.max(0, Number(rgb.r || 0))) / 255;
    const g = Math.min(255, Math.max(0, Number(rgb.g || 0))) / 255;
    const b = Math.min(255, Math.max(0, Number(rgb.b || 0))) / 255;
    const k = 1 - Math.max(r, g, b);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: Math.round(((1 - r - k) / (1 - k)) * 100),
      m: Math.round(((1 - g - k) / (1 - k)) * 100),
      y: Math.round(((1 - b - k) / (1 - k)) * 100),
      k: Math.round(k * 100)
    };
  }

  function hexToRgb(hex) {
    const normalized = String(hex || '#000000').replace('#', '').trim();
    const value = normalized.length === 3
      ? normalized.split('').map((part) => part + part).join('')
      : normalized.padStart(6, '0').slice(0, 6);
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function hexToCmyk(hex) {
    return rgbToCmyk(hexToRgb(hex));
  }

  function rgbToHex(rgb) {
    return `#${[rgb.r, rgb.g, rgb.b].map((value) => Math.min(255, Math.max(0, value)).toString(16).padStart(2, '0')).join('')}`;
  }

  function cmykToHex(color) {
    return rgbToHex(cmykToRgb(color));
  }

  function estimateArea(project) {
    const layout = computeProjectLayout(project);
    return {
      nameCount: project.groups.reduce((sum, group) => sum + flattenNames(group).length, 0),
      groupCount: project.groups.length,
      areaCm2: Number((layout.widthCm * layout.heightCm).toFixed(2))
    };
  }

  return {
    DEFAULT_SETTINGS,
    SIZE_RULES_CM,
    normalizeName,
    countLetters,
    countI,
    getAutoSizeCm,
    getNameMetrics,
    getNameHeightCm,
    getOutlineThicknessCm,
    getEffectiveMaxGroups,
    makeHeader,
    getHeaderMetrics,
    createProject,
    addGroup,
    addResi,
    computeProjectLayout,
    finishGroup,
    cmykToRgb,
    cmykToCss,
    rgbToCmyk,
    hexToRgb,
    hexToCmyk,
    rgbToHex,
    cmykToHex,
    estimateArea
  };
});
