import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const roots = [resolve('apps/web/src'), resolve('apps/bff/src')];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const ignoredSegments = ['/__tests__/', '/fixtures/', '/dist/', '/node_modules/'];
const ignoredSuffixes = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.test.js', '.spec.js'];
const suspiciousPatterns = [
  /[ÐÑРЧ�]/u,
  /×[^\s\dA-Za-z\u0590-\u05FF]/u
];

function walk(dir, results = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const rel = relative(process.cwd(), fullPath).replaceAll('\\', '/');
    if (ignoredSegments.some((segment) => rel.includes(segment))) {
      continue;
    }

    if (ignoredSuffixes.some((suffix) => rel.endsWith(suffix))) {
      continue;
    }

    if (!allowedExtensions.has(fullPath.slice(fullPath.lastIndexOf('.')))) {
      continue;
    }

    results.push(fullPath);
  }

  return results;
}

const offenders = [];

for (const root of roots) {
  for (const filePath of walk(root)) {
    let text;
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    if (suspiciousPatterns.some((pattern) => pattern.test(text))) {
      const lines = text.split(/\r?\n/);
      const matches = [];
      for (let index = 0; index < lines.length; index += 1) {
        if (suspiciousPatterns.some((pattern) => pattern.test(lines[index]))) {
          matches.push(`${index + 1}: ${lines[index].trim()}`);
        }
      }

      offenders.push({
        file: relative(process.cwd(), filePath).replaceAll('\\', '/'),
        matches
      });
    }
  }
}

if (offenders.length > 0) {
  console.error('Suspicious mojibake detected in source files:');
  for (const offender of offenders) {
    console.error(`- ${offender.file}`);
    for (const line of offender.matches.slice(0, 5)) {
      console.error(`  ${line}`);
    }
  }
  process.exit(1);
}

console.log(`Checked ${roots.length} source roots. No suspicious mojibake detected.`);
