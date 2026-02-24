import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir, filter) => {
  const out = [];
  for (const item of readdirSync(dir)) {
    const full = join(dir, item);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
};

const errors = [];
const cssFiles = walk('apps', (f) => f.endsWith('/src/index.css'));
for (const file of cssFiles) {
  const css = readFileSync(file, 'utf8');
  if (/\bbutton\s*\{|\.btn[-\w]*\s*\{|\[role="button"\]/.test(css)) {
    errors.push(`${file}: contains forbidden button styling rules`);
  }
}

const tsFiles = walk('apps', (f) => /\.tsx?$/.test(f) && !f.includes('node_modules'));
for (const file of tsFiles) {
  const src = readFileSync(file, 'utf8');
  if (/from ['"][^'"]*button[^'"]*['"]/.test(src) && !/from ['"]@kahade\/ui['"]/.test(src)) {
    errors.push(`${file}: imports button from non-shared module`);
  }
}

if (errors.length) {
  console.error('Button system enforcement failed:\n' + errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Button system enforcement passed.');
