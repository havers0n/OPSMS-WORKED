import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(webRoot, 'src');

const importFromRe = /^\s*import\s+.+\s+from\s+['"]([^'"]+)['"]/;
const exportFromRe = /^\s*export\s+.+\s+from\s+['"]([^'"]+)['"]/;
const bareImportRe = /^\s*import\s+['"]([^'"]+)['"]/;

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function isRelativeSpecifier(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function getViolationReason(specifier) {
  if (specifier.startsWith('@/entities/layout-version/model/')) {
    return 'legacy alias import from @/entities/layout-version/model/*';
  }

  if (specifier.startsWith('@/widgets/warehouse-editor/lib/')) {
    return 'legacy alias import from the previous warehouse editor lib path';
  }

  if (isRelativeSpecifier(specifier)) {
    const normalized = toPosix(path.posix.normalize(toPosix(specifier)));

    if (normalized.includes('entities/layout-version/model/')) {
      return 'legacy relative import into entities/layout-version/model/*';
    }

    if (normalized.includes('widgets/warehouse-editor/lib/')) {
      return 'legacy relative import into the previous warehouse editor lib path';
    }
  }

  return null;
}

function collectTsFiles(dirPath, bucket) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      collectTsFiles(fullPath, bucket);
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      bucket.push(fullPath);
    }
  }
}

function extractSpecifier(line) {
  return (
    line.match(importFromRe)?.[1] ??
    line.match(exportFromRe)?.[1] ??
    line.match(bareImportRe)?.[1] ??
    null
  );
}

function scanFile(filePath, violations) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inBlockComment) {
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith('//')) {
      continue;
    }

    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) {
        inBlockComment = true;
      }
      continue;
    }

    const specifier = extractSpecifier(line);
    if (!specifier) {
      continue;
    }

    const reason = getViolationReason(specifier);
    if (!reason) {
      continue;
    }

    violations.push({
      file: toPosix(path.relative(webRoot, filePath)),
      line: i + 1,
      statement: trimmed,
      specifier,
      reason
    });
  }
}

if (!fs.existsSync(srcRoot)) {
  console.error(`[guardrail] source directory not found: ${srcRoot}`);
  process.exit(1);
}

const tsFiles = [];
collectTsFiles(srcRoot, tsFiles);

const violations = [];
for (const file of tsFiles) {
  scanFile(file, violations);
}

if (violations.length === 0) {
  console.log(`[guardrail] OK: no legacy runtime imports found in ${toPosix(path.relative(webRoot, srcRoot))}`);
  process.exit(0);
}

console.error(`[guardrail] Found ${violations.length} forbidden legacy runtime import(s):`);
for (const violation of violations) {
  console.error(`- ${violation.file}:${violation.line}`);
  console.error(`  statement: ${violation.statement}`);
  console.error(`  reason: ${violation.reason}`);
}

console.error('');
console.error('forbidden legacy runtime import detected');
console.error('use @/warehouse/editor/model/... or current canonical owner');
console.error('remove imports from @/entities/layout-version/model/*');
console.error('remove legacy warehouse editor lib imports');

process.exit(1);
