import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(packageRoot, 'dist');

const relativeSpecifierPattern =
  /\b(from\s+['"]|import\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g;

function hasRuntimeExtension(specifier) {
  return path.extname(specifier) !== '';
}

async function fixFile(filePath) {
  const source = await readFile(filePath, 'utf8');
  const next = source.replace(
    relativeSpecifierPattern,
    (match, prefix, specifier, suffix) => {
      if (hasRuntimeExtension(specifier)) {
        return match;
      }

      return `${prefix}${specifier}.js${suffix}`;
    }
  );

  if (next !== source) {
    await writeFile(filePath, next);
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath);
        return;
      }

      if (entry.isFile() && entry.name.endsWith('.js')) {
        await fixFile(entryPath);
      }
    })
  );
}

await walk(distRoot);
