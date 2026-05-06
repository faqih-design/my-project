const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const markers = ['<<<<<<<', '=======', '>>>>>>>'];
const failures = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    content.split(/\r?\n/).forEach((line, index) => {
      if (markers.some((marker) => line.startsWith(marker))) {
        failures.push(`${path.relative(ROOT, fullPath)}:${index + 1}: ${line}`);
      }
    });
  }
}

walk(ROOT);

if (failures.length > 0) {
  console.error('Conflict markers found:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('No conflict markers found.');
