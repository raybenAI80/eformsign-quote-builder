// 견적서 빌더 브라우저 검증 공용 도구: vite 기동, playwright 실행, 견적 입력 시나리오.
// verify-quote-scenario.mjs 의 입력 절차를 모듈로 옮긴 것이다 (측정 스크립트가 같은 견적을 만들도록).
//
// 환경변수는 vite 프로세스에만 필요하다. 호출하는 스크립트를 `node --env-file=<파일>` 로 실행하면
// 그 값이 vite 자식 프로세스로 상속된다. 값은 출력하지 않는다.
//   PW_CHROME = chrome-headless-shell.exe 경로
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadPlaywright() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return createRequire(import.meta.url)(
    process.env.PLAYWRIGHT_CORE || join(home, '.agent-harness', 'vendor', 'gstack', 'node_modules', 'playwright-core'),
  );
}

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

/** 앱을 열고(/?bypass-auth) 온보딩을 건너뛴 뒤 견적을 채운다. 1440x1000, 다운로드 허용, 저장 선택창 제거. */
export async function openAndFill(browser, base, { customer, dsf = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dsf, acceptDownloads: true });
  await ctx.addInitScript(() => {
    try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch { /* 이미 없음 */ }
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/?bypass-auth`);
  await page.waitForTimeout(2000);
  const skip = page.getByText('건너뛰기');
  if (await skip.count()) await skip.first().click();
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
