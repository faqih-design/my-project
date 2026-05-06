const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/layoutEngine');

test('normalizes entered names to uppercase', () => {
  assert.equal(engine.normalizeName('  budi  santoso '), 'BUDI SANTOSO');
});

test('applies specified auto-resize rules for short names and I counts', () => {
  assert.equal(engine.getAutoSizeCm('BUDI'), 9);
  assert.equal(engine.getAutoSizeCm('III'), 5);
  assert.equal(engine.getAutoSizeCm('AB'), 6);
  assert.equal(engine.getAutoSizeCm('I'), 2);
  assert.equal(engine.getAutoSizeCm('A'), 3);
  assert.equal(engine.getAutoSizeCm('ABCDE'), 12);
});

test('builds header template from code, number, ruko, delivery, and date', () => {
  assert.equal(
    engine.makeHeader({ kode: 'krupuk', nomor: 1, ruko: 'resi ruko 2', pengiriman: 'rbs', tanggal: '01' }),
    'KRUPUK 1 RESI RUKO 2 RBS 01'
  );
});

test('enforces five-group limit when private mode is disabled', () => {
  const project = engine.createProject();
  for (let index = 0; index < 5; index += 1) {
    const result = engine.addGroup(project, { kode: 'KRUPUK', nomor: index + 1 });
    assert.equal(result.ok, true);
  }
  const blocked = engine.addGroup(project, { kode: 'KRUPUK', nomor: 6 });
  assert.equal(blocked.ok, false);
  assert.match(blocked.warning, /Batas maksimal 5 kode/);
});

test('allows custom group limit in private unlock mode', () => {
  const project = engine.createProject({ privateMode: true, privateMaxGroups: 6 });
  for (let index = 0; index < 6; index += 1) {
    assert.equal(engine.addGroup(project, { kode: 'ADMIN', nomor: index + 1 }).ok, true);
  }
  assert.equal(engine.addGroup(project, { kode: 'ADMIN', nomor: 7 }).ok, false);
});

test('places names in four fixed columns while preserving order', () => {
  const project = engine.createProject({ columnMaxHeightCm: 8 });
  engine.addGroup(project, { kode: 'KRUPUK', nomor: 1 });
  engine.addResi(project, 'R1', ['ANA', 'BUDI', 'CECEP', 'DEDI']);
  const layout = engine.computeProjectLayout(project);
  const positions = layout.groups[0].positions;
  assert.deepEqual(positions.map((item) => item.value), ['ANA', 'BUDI', 'CECEP', 'DEDI']);
  assert.ok(new Set(positions.map((item) => item.column)).size > 1);
  assert.deepEqual(project.settings.columnPositionsCm, [0.3, 14.5, 29, 45]);
});

test('moves whole resi to a new group if current group lacks space', () => {
  const project = engine.createProject({ columnMaxHeightCm: 6 });
  engine.addGroup(project, { kode: 'KRUPUK', nomor: 1 });
  engine.addResi(project, 'R1', ['ABCDE', 'ABCDE', 'ABCDE', 'ABCDE']);
  const result = engine.addResi(project, 'R2', ['ABCDE', 'ABCDE', 'ABCDE', 'ABCDE']);
  assert.equal(result.ok, true);
  assert.equal(project.groups.length, 2);
  assert.equal(project.groups[1].resiBlocks[0].id, 'R2');
});

test('finish group switches to sequential balanced mode', () => {
  const project = engine.createProject();
  const groupResult = engine.addGroup(project, { kode: 'KRUPUK', nomor: 1 });
  engine.addResi(project, 'R1', ['ANA', 'BUDI']);
  engine.addResi(project, 'R2', ['CECEP', 'DEDI']);
  engine.finishGroup(groupResult.group);
  assert.equal(groupResult.group.layoutMode, 'balanced');
  const layout = engine.computeProjectLayout(project);
  assert.deepEqual(layout.groups[0].positions.map((item) => item.value), ['ANA', 'BUDI', 'CECEP', 'DEDI']);
});

test('estimates area with name and group counters', () => {
  const project = engine.createProject();
  engine.addGroup(project, { kode: 'KRUPUK', nomor: 1 });
  engine.addResi(project, 'R1', ['ANA', 'BUDI']);
  const estimate = engine.estimateArea(project);
  assert.equal(estimate.nameCount, 2);
  assert.equal(estimate.groupCount, 1);
  assert.ok(estimate.areaCm2 > 0);
});

test('name metrics keep internal cm dimensions consistent for preview scaling', () => {
  const project = engine.createProject();
  const metrics = engine.getNameMetrics('BUDI', project.settings);
  assert.equal(metrics.sizeCm, 9);
  assert.equal(metrics.heightCm, metrics.textHeightCm);
  assert.ok(metrics.fontSizeCm > 0);
  assert.ok(metrics.boxHeightCm >= metrics.heightCm);
  assert.ok(metrics.outlineCm <= project.settings.outlineMaxCm);
});

test('computed layout leaves vertical spacing between names in the same column', () => {
  const project = engine.createProject({ columnMaxHeightCm: 12 });
  engine.addGroup(project, { kode: 'KRUPUK', nomor: 1 });
  engine.addResi(project, 'R1', ['ANA', 'BUDI', 'CECEP', 'DEDI', 'EKO', 'FANI']);
  const positions = engine.computeProjectLayout(project).groups[0].positions;
  const byColumn = new Map();
  for (const item of positions) {
    if (!byColumn.has(item.column)) byColumn.set(item.column, []);
    byColumn.get(item.column).push(item);
  }
  for (const columnItems of byColumn.values()) {
    for (let index = 1; index < columnItems.length; index += 1) {
      const previous = columnItems[index - 1];
      const current = columnItems[index];
      assert.ok(current.yCm >= previous.yCm + previous.heightCm + project.settings.nameSpacingCm - 0.001);
    }
  }
});


test('computed layout exposes consistent object boxes for header and names', () => {
  const project = engine.createProject();
  engine.addGroup(project, { kode: 'KRUPUK', nomor: 1, ruko: 'RESI RUKO 2', pengiriman: 'RBS', tanggal: '01' });
  engine.addResi(project, 'R1', ['BUDI']);
  const group = engine.computeProjectLayout(project).groups[0];
  assert.ok(group.headerObject.value.includes('KRUPUK'));
  for (const object of [group.headerObject, group.positions[0]]) {
    assert.equal(typeof object.xCm, 'number');
    assert.equal(typeof object.yCm, 'number');
    assert.ok(object.widthCm > 0);
    assert.ok(object.heightCm > 0);
    assert.ok((object.outlineSizeCm ?? object.outlineCm) >= 0);
    assert.ok(object.boundingBox.widthCm >= object.widthCm);
    assert.ok(object.boundingBox.heightCm >= object.heightCm);
  }
});

test('converts visual hex colors to internal CMYK values', () => {
  assert.deepEqual(engine.hexToCmyk('#000000'), { c: 0, m: 0, y: 0, k: 100 });
  assert.deepEqual(engine.hexToCmyk('#ffffff'), { c: 0, m: 0, y: 0, k: 0 });
  assert.deepEqual(engine.hexToCmyk('#ff0000'), { c: 0, m: 100, y: 100, k: 0 });
});

test('converts internal CMYK colors back to visual hex colors', () => {
  assert.equal(engine.cmykToHex({ c: 0, m: 0, y: 0, k: 100 }), '#000000');
  assert.equal(engine.cmykToHex({ c: 0, m: 0, y: 0, k: 0 }), '#ffffff');
});
