// 정적 회귀 검사. 사람이 기억해서 지키던 규칙을 테스트가 막는다(2026-11-05 하루 6건 회귀의 재발 방지).
//   1. 숫자 입력칸은 ThousandsInput 만 쓴다 (쉼표 깨짐 `2,00000`)
//   2. 인자 없는 toLocaleString/toLocaleDateString/toLocaleTimeString 금지 (브라우저 언어마다 달라짐)
//   3. 진입점에서 도달하지 않는 src 모듈 금지 (죽은 코드가 기능으로 오인됨)
// 각 검사는 순수 함수(문자열 → 위반 목록)라서 아래 "음성 확인" 테스트가 일부러 만든 위반을 실제로 잡는지 확인한다.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOW, findUnusedModules } from '../../tools/check-unused-modules.mjs';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (p: string) => relative(ROOT, p).split(sep).join('/');
const isTest = (p: string) => /\.test\.(ts|tsx)$/.test(p) || p.includes(`${sep}__guards__${sep}`);
const sources = (re: RegExp) => walk(SRC).filter(p => re.test(p) && !isTest(p));

// ---- 1. 숫자 입력칸 ---------------------------------------------------------------------------
const NUMERIC_ATTR = /inputMode\s*=\s*["{'`]+\s*(numeric|decimal)|pattern\s*=\s*["']\[0-9\]\*["']|type\s*=\s*["']number["']/;
const NUMERIC_OK = /numeric-input-ok:\s*\S/;
const THOUSANDS_INPUT_FILE = 'src/components/common/ThousandsInput.tsx';
const NUMERIC_OK_WINDOW = 3; // 같은 줄 또는 위 3줄 안에 예외 주석

export function findNumericInputViolations(file: string, text: string): string[] {
  if (file === THOUSANDS_INPUT_FILE) return [];
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (!NUMERIC_ATTR.test(line)) return;
    const from = Math.max(0, i - NUMERIC_OK_WINDOW);
    if (lines.slice(from, i + 1).some(l => NUMERIC_OK.test(l))) return;
    out.push(`${file}:${i + 1}: 숫자 입력칸은 ThousandsInput 을 쓰거나 "// numeric-input-ok: <이유>" 를 달아야 한다 -> ${line.trim()}`);
  });
  return out;
}

// ---- 2. 인자 없는 toLocale* ---------------------------------------------------------------------
const BARE_LOCALE = /\.toLocale(?:Date|Time)?String\(\s*\)/;

export function findBareLocaleViolations(file: string, text: string): string[] {
  const out: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (BARE_LOCALE.test(line)) {
      out.push(`${file}:${i + 1}: 인자 없는 toLocale*String() 금지. 숫자는 nf/formatThousands/toKRW, 날짜는 'ko-KR' 를 명시 -> ${line.trim()}`);
    }
  });
  return out;
}

describe('숫자 입력칸 규칙', () => {
  it('src 의 숫자 입력칸은 ThousandsInput 이거나 예외 주석이 있다', () => {
    const v = sources(/\.tsx$/).flatMap(p => findNumericInputViolations(rel(p), readFileSync(p, 'utf8')));
    expect(v).toEqual([]);
  });

  it('음성 확인: 날코드 숫자 입력칸을 잡고, 예외 주석이 있으면 통과시킨다', () => {
    const raw = `<input type="text" inputMode="numeric" value={v} />`;
    expect(findNumericInputViolations('src/x.tsx', raw)).toHaveLength(1);
    expect(findNumericInputViolations('src/x.tsx', `<input pattern="[0-9]*" />`)).toHaveLength(1);
    expect(findNumericInputViolations('src/x.tsx', `<input type="number" />`)).toHaveLength(1);
    const ok = `<input\n  // numeric-input-ok: 퍼센트 칸\n  inputMode="decimal"\n/>`;
    expect(findNumericInputViolations('src/x.tsx', ok)).toEqual([]);
    expect(findNumericInputViolations(THOUSANDS_INPUT_FILE, raw)).toEqual([]);
  });
});

describe('로케일 의존 포맷 금지', () => {
  it('src 에 인자 없는 toLocaleString/toLocaleDateString/toLocaleTimeString 이 없다', () => {
    const v = sources(/\.(ts|tsx)$/).flatMap(p => findBareLocaleViolations(rel(p), readFileSync(p, 'utf8')));
    expect(v).toEqual([]);
  });

  it('음성 확인: 인자 없는 호출은 잡고 로케일을 준 호출은 통과시킨다', () => {
    expect(findBareLocaleViolations('a.ts', 'n.toLocaleString()')).toHaveLength(1);
    expect(findBareLocaleViolations('a.ts', 'd.toLocaleDateString( )')).toHaveLength(1);
    expect(findBareLocaleViolations('a.ts', "d.toLocaleTimeString()")).toHaveLength(1);
    expect(findBareLocaleViolations('a.ts', "n.toLocaleString('en-US')")).toEqual([]);
    expect(findBareLocaleViolations('a.ts', "d.toLocaleDateString('ko-KR', { month: 'short' })")).toEqual([]);
  });
});

// ---- 3. 미사용 모듈 -----------------------------------------------------------------------------
describe('미사용 모듈 규칙', () => {
  it('index.html 진입점에서 도달하지 않는 src 모듈이 없다', () => {
    const { unused, staleAllow } = findUnusedModules(ROOT, { allow: ALLOW });
    expect(unused).toEqual([]);
    expect(staleAllow).toEqual([]);
  });

  it('음성 확인: 아무도 부르지 않는 파일을 잡고, 허용 목록에 올리면 통과시킨다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'unused-guard-'));
    try {
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(join(dir, 'index.html'), '<script type="module" src="/src/index.tsx"></script>');
      writeFileSync(join(dir, 'src', 'index.tsx'), "import { a } from './a';\nimport('@/src/c');\nexport { a };");
      writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1;');
      writeFileSync(join(dir, 'src', 'c.ts'), 'export const c = 1;');
      writeFileSync(join(dir, 'src', 'dead.ts'), 'export const dead = 1;');
      writeFileSync(join(dir, 'src', 'dead.test.ts'), "import './dead';");
      expect(findUnusedModules(dir).unused).toEqual(['src/dead.ts']);
      expect(findUnusedModules(dir, { allow: { 'src/dead.ts': '테스트용' } }).unused).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
