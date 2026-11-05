// 미사용 모듈 검사: index.html 의 진입 스크립트에서 import 그래프를 따라가고, 도달하지 못하는 src 의 .ts/.tsx 를 찾는다.
// 화면에서 도달할 수 없는 죽은 코드(예: 부르는 곳이 없는 CSV 내보내기)가 "기능"으로 오인되는 일을 막는다(2026-11-05).
//   node tools/check-unused-modules.mjs [저장소 루트]   → 미사용 파일이 있으면 exit 1
// 테스트(src/__guards__/guards.test.ts)가 findUnusedModules() 를 직접 호출한다. 새 의존성은 없다.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
// import/export ... from '...' , import '...' , import('...')
const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;

// 소스 파일이지만 진입점에서 도달하지 않아도 되는 것(테스트·타입 선언). 도달 못 하는 일반 파일은 허용 목록에 이유를 적어야 한다.
const isExempt = rel => /\.test\.(ts|tsx)$/.test(rel) || rel.endsWith('.d.ts');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function resolveSpec(spec, fromFile, root) {
  let base;
  if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else if (spec.startsWith('@/')) base = resolve(root, spec.slice(2)); // tsconfig·vite 의 '@' = 저장소 루트
  else return null; // 외부 패키지
  const candidates = [base, ...EXTS.map(e => base + e), ...EXTS.map(e => join(base, 'index' + e))];
  return candidates.find(c => existsSync(c) && statSync(c).isFile()) ?? null;
}

/** @param {string} root 저장소 루트  @param {{allow?: Record<string,string>}} [opts] allow: 상대경로 → 허용 이유 */
export function findUnusedModules(root, opts = {}) {
  const allow = opts.allow ?? {};
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const entries = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => resolve(root, m[1].replace(/^\//, '')))
    .filter(p => existsSync(p));
  if (!entries.length) throw new Error('index.html 에서 진입 스크립트를 찾지 못했다.');

  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!EXTS.includes(file.slice(file.lastIndexOf('.')))) continue; // css 등은 따라가지 않는다
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(IMPORT_RE)) {
      const target = resolveSpec(m[2], file, root);
      if (target && !seen.has(target)) stack.push(target);
    }
  }

  const srcDir = join(root, 'src');
  const rel = p => relative(root, p).split(sep).join('/');
  const unused = walk(srcDir)
    .filter(p => /\.(ts|tsx)$/.test(p))
    .map(rel)
    .filter(r => !isExempt(r) && !seen.has(resolve(root, r)) && !(r in allow));
  const staleAllow = Object.keys(allow).filter(r => !existsSync(join(root, r)) || seen.has(resolve(root, r)));
  return { unused: unused.sort(), staleAllow, reached: seen.size };
}

// 의도적으로 진입점에서 도달하지 않는 파일. "상대경로": "이유" 형식. 현재 없음.
/** @type {Record<string, string>} */
export const ALLOW = {};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
  const { unused, staleAllow, reached } = findUnusedModules(root, { allow: ALLOW });
  console.log(`진입점에서 도달한 파일 ${reached}개`);
  for (const f of unused) console.log(`미사용: ${f}`);
  for (const f of staleAllow) console.log(`허용 목록이 낡음(파일이 없거나 이제 쓰임): ${f}`);
  if (unused.length || staleAllow.length) process.exit(1);
  console.log('미사용 모듈 없음');
}
