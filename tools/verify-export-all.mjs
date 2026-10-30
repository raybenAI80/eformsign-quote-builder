// 출력물(PDF·PNG·미리보기) 브라우저 검증 일괄 실행기.
// vite dev 서버를 한 번만 띄우고(QB_BASE_URL) 검증 도구 7종을 차례로 실행한다. 하나라도 실패하면 exit 1.
//   1 verify-pagination    PDF 쪽 구성(한 장/여러 쪽)·메뉴·기억·병합·PNG
//   2 verify-payment-info  결제 정보 블록(Enterprise 견적에서만)
//   3 verify-seal-options  직인 표시 카드 순서·기본값
//   4 verify-png-button    헤더 PNG 저장 버튼
//   5 verify-footer-copy   하단 강점 칸 문구 줄 나눔
//   6 verify-pdf-menu-copy PDF 저장 메뉴 문구
//   7 verify-business-overage Business 구독형 초과 단가 문구(견적일 기준 600→800원, 미리보기·PDF 글자)
// 1~4 는 관찰값만 출력하는 도구라서 이 실행기가 결과(results.json·표준 출력)를 읽어 기대값과 대조한다. 5·6 은 도구가 직접 exit 1 한다.
//
// 실행: npm run verify:export [-- <출력 폴더>] [--only pagination,payment,seal,png,footer,menu,overage]
//   환경변수 파일(.env·.env.local)은 저장소 루트에서, 없으면(worktree) 메인 체크아웃에서 찾아 읽는다. 값은 출력하지 않는다.
//   PW_CHROME 이 없으면 %LOCALAPPDATA%\ms-playwright 의 최신 chrome-headless-shell 을 쓴다.
//   PYI 는 비운다(shim 의 python 에는 pymupdf 가 없다). 시스템 python 에 pymupdf 가 있어야 한다.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ROOT, startVite } from './lib/quote-driver.mjs';

const args = process.argv.slice(2);
const OUT = resolve(args.find(a => !a.startsWith('--')) ?? join(ROOT, '.work', 'verify-export'));
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',')) : null;
mkdirSync(OUT, { recursive: true });

// ---- 환경 준비 ----------------------------------------------------------------------------
function findEnvDirs() {
  const dirs = [ROOT];
  // worktree 면 메인 체크아웃(git 공용 디렉터리의 부모)도 후보
  const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status === 0) dirs.push(dirname(r.stdout.trim()));
  return dirs;
}
const loaded = [];
for (const dir of findEnvDirs()) {
  for (const name of ['.env', '.env.local']) {
    const p = join(dir, name);
    if (existsSync(p) && !loaded.some(l => l.endsWith(name))) { process.loadEnvFile(p); loaded.push(p); }
  }
}
console.log('env 파일:', loaded.length ? loaded.join(', ') : '(없음)');

if (!process.env.PW_CHROME) {
  const base = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  const found = existsSync(base)
    ? readdirSync(base).filter(d => d.startsWith('chromium_headless_shell-')).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
        .map(d => join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')).find(existsSync)
    : null;
  if (!found) { console.error('PW_CHROME 를 지정하거나 ms-playwright 에 chrome-headless-shell 을 설치하라.'); process.exit(1); }
  process.env.PW_CHROME = found;
}
delete process.env.PYI;
const pyCheck = spawnSync('python', ['-c', 'import fitz'], { encoding: 'utf8' });
if (pyCheck.status !== 0) { console.error('시스템 python 에 pymupdf(fitz)가 없다. PDF 분석 도구가 동작하지 않는다.'); process.exit(1); }

// ---- 기대값 대조 ---------------------------------------------------------------------------
const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const walk = (v, fn) => { if (Array.isArray(v)) v.forEach(x => walk(x, fn)); else if (v && typeof v === 'object') { fn(v); Object.values(v).forEach(x => walk(x, fn)); } };

function checkPagination(dir) {
  const f = [];
  const r = readJson(join(dir, 'results.json'));
  const S = r.steps;
  const pages = k => S[k]?.pdf?.pages;
  const eq = (name, got, want) => { if (got !== want) f.push(`${name}: ${got} (기대 ${want})`); };
  eq('fit3 PDF 쪽 수', pages('fit3'), 1);
  eq('paged3 PDF 쪽 수(3건은 1쪽)', pages('paged3'), 1);
  eq('paged3 저장된 방식', S.paged3?.stored, 'paged');
  eq('fit26 PDF 쪽 수(한 장)', pages('fit26'), 1);
  if (!(pages('paged26') >= 2)) f.push(`paged26 PDF 쪽 수: ${pages('paged26')} (기대 2 이상)`);
  if (!(pages('paged50') >= 3)) f.push(`paged50 PDF 쪽 수: ${pages('paged50')} (기대 3 이상)`);
  if (!(pages('public') >= 3)) f.push(`public PDF 쪽 수: ${pages('public')} (기대 3 이상)`);
  eq('병합 PDF 쪽 수(3건 견적 1쪽 + 26건 견적 2쪽)', pages('merge'), 3);
  eq('메뉴 열림 aria-expanded', S.menu?.expanded, 'true');
  eq('Esc 후 메뉴 수', S.menu?.afterEsc?.menu, 0);
  eq('바깥 클릭 후 메뉴 수', S.menu?.afterOutside?.menu, 0);
  eq('새로고침 후 기억된 방식', S.reload?.stored, 'paged');
  eq('Enter 로 저장 후 메뉴 닫힘', S['kbd-enter']?.menuClosed, true);
  eq('paged 모드에서도 PNG 는 한 장 이미지(너비)', S['png-in-paged-mode']?.width, 2246);
  walk(S, o => {
    if (o.ok === false) f.push('PDF 분석 실패(ok=false)');
    if (Array.isArray(o.dy)) for (const d of o.dy) {
      if (d.dy != null && Math.abs(Number(d.dy)) > 0.5) f.push(`글자 위치 어긋남 dy=${d.dy}mm (쪽 ${d.page})`);
      if (d.dxRight != null && Math.abs(Number(d.dxRight)) > 0.5) f.push(`글자 위치 어긋남 dxRight=${d.dxRight}mm (쪽 ${d.page})`);
    }
    if (o.clipped != null && o.clipped !== 0) f.push(`잘린 행 clipped=${o.clipped} (쪽 ${o.page})`);
    if (o.lastRowIsCat === true) f.push(`쪽 끝에 구분 행만 남음 (쪽 ${o.page})`);
  });
  if (r.consoleErrors?.length) f.push(`콘솔 오류 ${r.consoleErrors.length}건`);
  return f;
}

function checkPayment(dir) {
  const f = [];
  const r = readJson(join(dir, 'results.json'));
  const S = r.steps;
  const hits = perPage => Object.values(perPage?.hits ?? {}); // 키는 검색어(인코딩이 깨질 수 있어 순서만 쓴다): 결제 정보, 신한은행, 사업자등록증
  const A = S['A-enterprise'], B = S['B-no-enterprise'];
  if (A?.preview?.payBlocks < 1) f.push('A: Enterprise 견적인데 미리보기에 결제 정보가 없음');
  if (!hits(A?.pdf?.perPage?.[0]).every(h => h >= 1)) f.push('A: Enterprise 견적 PDF 에 결제 정보 글자가 없음');
  if (B?.preview?.payBlocks !== 0) f.push('B: Enterprise 없는 견적인데 미리보기에 결제 정보가 있음');
  if (!hits(B?.pdf?.perPage?.[0]).every(h => h === 0)) f.push('B: Enterprise 없는 견적 PDF 에 결제 정보 글자가 있음');
  const C = S['C-paged26-no-enterprise'], D = S['D-paged26-enterprise'];
  const lastC = C?.preview?.pages?.at(-1), lastD = D?.preview?.pages?.at(-1);
  if (lastC?.hasPay !== false) f.push('C: Enterprise 없는 여러 쪽 견적의 마지막 쪽에 결제 정보가 있음');
  if (lastD?.hasPay !== true) f.push('D: Enterprise 여러 쪽 견적의 마지막 쪽에 결제 정보가 없음');
  if (lastD?.hasSum !== true) f.push('D: 마지막 쪽에 합계가 없음');
  for (const [k, s] of [['C', C], ['D', D]]) for (const p of s?.preview?.pages ?? []) if (p.clipped !== 0) f.push(`${k}: 쪽 ${p.page} 에 잘린 행 ${p.clipped}`);
  const E = S['E-merged']?.pdf;
  if (E?.pages !== 2) f.push(`E: 병합 PDF 쪽 수 ${E?.pages} (기대 2)`);
  if (!hits(E?.perPage?.[0]).every(h => h >= 1)) f.push('E: 병합 PDF 1쪽(Enterprise 견적)에 결제 정보가 없음');
  if (!hits(E?.perPage?.[1]).every(h => h === 0)) f.push('E: 병합 PDF 2쪽(Enterprise 없음)에 결제 정보가 있음');
  const F = S['F-history-snapshot'];
  if (!(F?.currentHasEnterprise >= 1)) f.push('F: 현재 견적에 Enterprise 가 없는 상태로 시나리오가 시작됨');
  if (F?.snapshotPreviewPayBlocks !== 0) f.push('F: 기록 스냅샷 미리보기가 현재 견적 기준으로 결제 정보를 그림');
  if (r.consoleErrors?.length) f.push(`콘솔 오류 ${r.consoleErrors.length}건`);
  return f;
}

function checkSeal(dir) {
  const f = [];
  const r = readJson(join(dir, 'results.json'));
  const order = c => c.cards.map(x => x.label.split('\n').pop());
  if (JSON.stringify(order(r.initial)) !== JSON.stringify(['숨김', '직인 생략', '직인 표시'])) f.push(`카드 순서 ${order(r.initial)} (기대 숨김·직인 생략·직인 표시)`);
  if (!r.initial.cards[0].selected) f.push('새 견적 기본값이 숨김이 아님');
  if (r.initial.preview.stamp !== 0 || r.initial.preview.omitText !== 0) f.push('기본값인데 미리보기에 직인 영역이 그려짐');
  if (r.pdf?.[2] && !/: 0 hit/.test(r.pdf[2])) f.push('기본값 PDF 에 「직인 생략」 글자가 있음');
  if (r['select-직인 생략']?.preview?.omitText !== 1) f.push('직인 생략을 골랐는데 「(직인 생략)」이 안 보임');
  if (!(r['select-직인 표시']?.preview?.stamp >= 1)) f.push('직인 표시를 골랐는데 직인이 안 보임');
  const hid = r['select-숨김']?.preview;
  if (hid?.stamp !== 0 || hid?.omitText !== 0) f.push('숨김을 골랐는데 직인 영역이 남음');
  if (!r.afterReset?.cards?.[0]?.selected) f.push('초기화 후 기본값이 숨김으로 돌아오지 않음');
  return f;
}

function checkPng(text) {
  const f = [];
  if (!/버튼 개수\(1440\): 1 \| 보임: true/.test(text)) f.push('1440px 에서 PNG 버튼이 1개로 보이지 않음');
  const m = /다운로드 파일명: (.+?\.png) .*이미지 크기: (\d+)x(\d+)/.exec(text);
  if (!m) f.push('PNG 다운로드 결과를 찾지 못함');
  else if (!(Number(m[3]) > Number(m[2]))) f.push(`PNG 크기 ${m[2]}x${m[3]} (세로가 가로보다 커야 함)`);
  if (!/미리보기 끈 상태: 다운로드됨 .+\.png \d+x\d+/.test(text)) f.push('미리보기를 끈 상태에서 PNG 저장이 안 됨');
  if (/실패|오류|Error/.test(text.replace(/Browserslist.*/g, ''))) f.push('출력에 실패·오류 문구가 있음');
  return f;
}

// ---- 실행 ----------------------------------------------------------------------------------
const STEPS = [
  { key: 'pagination', tool: 'verify-pagination.mjs', check: dir => checkPagination(dir) },
  { key: 'payment', tool: 'verify-payment-info.mjs', check: dir => checkPayment(dir) },
  { key: 'seal', tool: 'verify-seal-options.mjs', check: dir => checkSeal(dir) },
  { key: 'png', tool: 'verify-png-button.mjs', check: (dir, stdout) => checkPng(stdout) },
  { key: 'footer', tool: 'verify-footer-copy.mjs', check: () => [] },
  { key: 'menu', tool: 'verify-pdf-menu-copy.mjs', check: () => [] },
  { key: 'overage', tool: 'verify-business-overage.mjs', check: () => [] },
];

const vite = await startVite(Number(process.env.QB_PORT ?? 3019));
process.env.QB_BASE_URL = vite.base;
const summary = [];
try {
  for (const step of STEPS) {
    if (ONLY && !ONLY.has(step.key)) continue;
    const dir = join(OUT, step.key);
    mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    console.log(`\n== ${step.key} (${step.tool}) ...`);
    const r = spawnSync(process.execPath, [join(ROOT, 'tools', step.tool), dir], { cwd: ROOT, encoding: 'utf8', timeout: 12 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
    const stdout = r.stdout ?? '';
    writeFileSync(join(dir, 'output.log'), stdout + '\n--- stderr ---\n' + (r.stderr ?? ''));
    const failures = [];
    if (r.status !== 0) failures.push(`도구 종료 코드 ${r.status}${r.error ? ' ' + r.error.message : ''}`);
    else {
      try { failures.push(...step.check(dir, stdout)); } catch (e) { failures.push(`결과 해석 실패: ${e.message}`); }
    }
    const sec = Math.round((Date.now() - t0) / 1000);
    summary.push({ key: step.key, ok: failures.length === 0, sec, failures });
    console.log(failures.length ? `   FAIL (${sec}s)\n   - ${failures.join('\n   - ')}` : `   PASS (${sec}s)`);
  }
} finally {
  vite.stop();
}

writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log('\n=== verify:export 요약 ===');
for (const s of summary) console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${s.key.padEnd(11)} ${s.sec}s`);
console.log('결과 폴더:', OUT);
if (summary.length === 0) { console.error('실행한 단계가 없다(--only 값을 확인하라).'); process.exit(1); }
process.exit(summary.every(s => s.ok) ? 0 : 1);
