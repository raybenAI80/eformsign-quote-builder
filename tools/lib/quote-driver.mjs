// 견적서 빌더 브라우저 검증 공용 도구: vite 기동, playwright 실행, 견적 입력 시나리오.
// verify-quote-scenario.mjs 의 입력 절차를 모듈로 옮긴 것이다 (측정 스크립트가 같은 견적을 만들도록).
//
// 환경변수는 vite 프로세스에만 필요하다. 호출하는 스크립트를 `node --env-file=<파일>` 로 실행하면
// 그 값이 vite 자식 프로세스로 상속된다. 값은 출력하지 않는다.
//   PW_CHROME / CHROME_PATH = 브라우저 실행 파일 경로(없으면 resolveChrome 의 탐색 순서)
//   QB_PYTHON               = PDF 분석용 python 실행 파일(없으면 Windows 는 python, 그 외 python3)
//   PLAYWRIGHT_CORE         = playwright-core 위치(없으면 저장소 devDependency)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadPlaywright() {
  return createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE || 'playwright-core');
}

/**
 * 브라우저 실행 파일을 찾는다. 순서: PW_CHROME → CHROME_PATH → ms-playwright 캐시의 최신 chrome-headless-shell
 * (Windows %LOCALAPPDATA%, Linux ~/.cache, macOS ~/Library/Caches) → undefined(playwright 가 자기 기본 브라우저를 쓴다).
 * 지정한 경로가 없으면 조용히 넘어가지 않고 예외를 던진다.
 */
export function resolveChrome() {
  const explicit = process.env.PW_CHROME || process.env.CHROME_PATH;
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`브라우저 실행 파일이 없다: ${explicit}`);
    return explicit;
  }
  const plat = process.platform;
  const custom = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const cache = custom && custom !== '0' ? custom
    : plat === 'win32' ? join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
      : plat === 'darwin' ? join(homedir(), 'Library', 'Caches', 'ms-playwright')
        : join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return undefined;
  const exe = plat === 'win32' ? ['chrome-headless-shell-win64', 'chrome-headless-shell.exe']
    : plat === 'darwin' ? [`chrome-headless-shell-mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}`, 'chrome-headless-shell']
      : ['chrome-headless-shell-linux64', 'chrome-headless-shell'];
  return readdirSync(cache)
    .filter(d => d.startsWith('chromium_headless_shell-'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    .map(d => join(cache, d, ...exe))
    .find(existsSync);
}

/** chromium.launch 래퍼: 실행 파일은 resolveChrome 가 정한다. */
export function launchBrowser(chromium, options = {}) {
  return chromium.launch({ executablePath: resolveChrome(), ...options });
}

/** PDF 분석(pymupdf)용 python 명령. PYI(shim)는 pymupdf 가 없어 쓰지 않는다. */
export function pythonCmd() {
  return process.env.QB_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
}

/** python 을 실행한다. PYI 를 지우고, 비-UTF-8 로캘에서도 한글이 깨지지 않게 PYTHONIOENCODING 을 고정한다. */
export function runPython(args, options = {}) {
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', ...(options.env ?? {}) };
  delete env.PYI;
  return spawnSync(pythonCmd(), args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options, env });
}

/**
 * 인자 분해. valueFlags 에 든 `--flag 값` / `--flag=값` 의 값을 위치 인자로 오인하지 않는다
 * (예전에는 `--only seal,png` 의 값이 출력 폴더 이름이 되어 저장소 루트에 `seal,png,footer` 폴더가 생겼다).
 */
export function parseArgs(argv, valueFlags = []) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const eq = a.indexOf('=');
    const name = a.slice(2, eq < 0 ? undefined : eq);
    if (valueFlags.includes(name)) flags[name] = eq >= 0 ? a.slice(eq + 1) : argv[++i];
    else flags[name] = eq >= 0 ? a.slice(eq + 1) : true;
  }
  return { positional, flags };
}

/** 운영 번들과 같은 방식(CSS 가 <link> 로 서빙, 해시 파일)으로 빌드하되 ?bypass-auth 가 통하도록 NODE_ENV=development 로 빌드한다. */
export function buildBypassBundle(outDir) {
  let last = '';
  // esbuild 서비스 프로세스가 드물게 중간에 죽는다("The service was stopped", 2026-11-09 로컬 1회). 같은 입력으로 한 번 더 시도한다.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const b = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'development', '--outDir', outDir, '--emptyOutDir'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'development' } });
    if (b.status === 0) return;
    last = (b.stderr || b.stdout).slice(-800);
    console.error(`빌드 실패(시도 ${attempt}/2): ${last.slice(-300)}`);
  }
  throw new Error('빌드 실패: ' + last);
}

/** 빌드 결과를 vite preview 로 서빙한다. 반환: { base, stop }. */
export async function startPreview(outDir, port) {
  const proc = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', outDir, '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stderr.on('data', d => process.stderr.write(String(d)));
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base + '/')).ok) return { base, stop: () => proc.kill() }; } catch { /* 아직 */ }
    await new Promise(r => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error('vite preview 가 뜨지 않았다');
}

/** 임시 빌드 폴더(OS 임시 디렉터리). 저장소와 출력 폴더를 더럽히지 않는다. */
export const tempBuildDir = tag => mkdtempSync(join(tmpdir(), `qb-${tag}-`));

/** QB_BASE_URL 이 있으면(verify-export-all.mjs 가 vite 를 한 번만 띄운 경우) 새로 띄우지 않고 그 주소를 쓴다. 없으면 vite dev 서버를 띄운다. */
/** 반환값의 stop() 으로 이 프로세스만 종료한다. */
export async function startVite(port) {
  if (process.env.QB_BASE_URL) return { base: process.env.QB_BASE_URL.replace(/\/$/, ''), stop: () => {} };
  const base = `http://localhost:${port}`;
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  vite.stderr.on('data', d => process.stderr.write(String(d)));
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(base + '/');
      if (r.ok) return { base, stop: () => vite.kill() };
    } catch { /* 아직 안 뜸 */ }
    await new Promise(r => setTimeout(r, 500));
  }
  vite.kill();
  throw new Error('vite 서버가 뜨지 않았다');
}

const setDate = (page, value) =>
  page.locator('input[type="date"]').first().evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);

export const inputAfterLabel = (page, label) =>
  page.locator(`xpath=//label[normalize-space()="${label}"]/following::input[1]`).first();

export async function fillBasic(page, customer = '(주)한빛물산') {
  await page.getByRole('button', { name: /기본 정보/ }).first().click();
  await page.waitForTimeout(400);
  await setDate(page, '2026-10-01');
  await page.getByRole('button', { name: '1개월', exact: true }).click();
  await inputAfterLabel(page, '고객사명').fill(customer);
  await inputAfterLabel(page, '고객사 담당자 이름').fill('김민수 팀장');
  await inputAfterLabel(page, '고객사 이메일').fill('minsu.kim@hanbit.example');
  await inputAfterLabel(page, '고객사 연락처').fill('010-2345-6789');
}

export async function fillSales(page) {
  await inputAfterLabel(page, '담당자 이니셜').fill('BC');
  await inputAfterLabel(page, '발행 순번').fill('1'); // PDF 저장 검증(ensureValid)이 요구한다
  await inputAfterLabel(page, '영업 담당자 이름').fill('조병철');
  await inputAfterLabel(page, '직책').fill('프로');
  await inputAfterLabel(page, '이메일').fill('bcjo');
  await inputAfterLabel(page, '휴대전화').fill('12345678');
  await inputAfterLabel(page, '직통 번호').fill('8201');
}

/** 품목 3개를 추가하고 첫 항목에 할인율 10% 를 준다. */
export async function addItems(page) {
  await page.getByRole('button', { name: /항목/ }).first().click();
  await page.waitForTimeout(400);
  for (const name of ['+ Enterprise 2,000건', '+ 추가 문서', '+ 사용자 교육 1H']) {
    await page.getByRole('button', { name }).click();
    await page.waitForTimeout(250);
  }
  const pct = page.locator('xpath=//span[normalize-space()="할인율"]/following::input[1]').first();
  await pct.fill('10');
  await page.waitForTimeout(400);
}

/**
 * 앱이 뜰 때까지 기다린 뒤 온보딩 투어를 건너뛴다. 투어는 앱이 마운트되고 1초 뒤(App.tsx)에 뜨고, 이미 완료했으면(localStorage) 뜨지 않는다.
 * 예전에는 고정 2초를 기다린 뒤 한 번만 확인해서, 느린 실행(CI 러너·번들 로드 지연)에서는 투어가 확인 뒤에 떠 클릭을 가렸다.
 */
export async function dismissOnboarding(page) {
  await page.getByRole('button', { name: /기본 정보/ }).first().waitFor({ state: 'visible', timeout: 30000 });
  const done = await page.evaluate(() => localStorage.getItem('eformsign_quote_onboarding_completed') === 'true');
  if (done) return false;
  const skip = page.getByText('건너뛰기').first();
  await skip.waitFor({ state: 'visible', timeout: 8000 });
  await skip.click();
  await skip.waitFor({ state: 'hidden', timeout: 5000 });
  return true;
}

/** 앱을 열고(/?bypass-auth) 온보딩을 건너뛴 뒤 견적을 채운다. 1440x1000, 다운로드 허용, 저장 선택창 제거. */
export async function openAndFill(browser, base, { customer, dsf = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dsf, acceptDownloads: true });
  await ctx.addInitScript(() => {
    try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch { /* 이미 없음 */ }
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/?bypass-auth`);
  await dismissOnboarding(page);
  await page.waitForTimeout(300);
  await fillBasic(page, customer);
  await fillSales(page);
  await addItems(page);
  await page.getByRole('button', { name: /기본 정보/ }).first().click();
  await page.waitForTimeout(600);
  return { ctx, page };
}

/** 클릭 등으로 시작한 다운로드를 받아 저장한다. 걸린 시간(ms)도 함께 돌려준다. */
export async function downloadTo(page, trigger, savePath, timeout = 120000) {
  const t0 = Date.now();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout }), trigger()]);
  const ms = Date.now() - t0;
  await dl.saveAs(savePath);
  return { name: dl.suggestedFilename(), ms };
}
