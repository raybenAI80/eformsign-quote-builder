// 견적서 빌더 브라우저 시나리오 검증 (거래 정보 블록 "표 머리 띠" 변경 후).
// 절차 정본: skills/quote-builder-state-flow/SKILL.md 「브라우저 검증 시나리오」.
//
// 실행 (환경변수는 vite 프로세스에만 필요하며 node 가 파일에서 읽어 이 프로세스로 주입한다. 값은 출력하지 않는다):
//   PW_CHROME=<chrome-headless-shell.exe> node --env-file=<env 파일> tools/verify-quote-scenario.mjs <출력 폴더>
// 출력 폴더에 01-filled.png 02-reload.png 04-reset.png single.pdf merged.pdf preview-standalone.html results.json 를 쓴다.
// 03-pdf.png·PDF 측정은 tools/inspect-pdf.py 가 맡는다. dev 서버(vite)는 이 스크립트가 띄우고 종료한다.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, '.work', 'verify'));
const PORT = Number(process.env.QB_PORT ?? 3011); // 3001 은 다른 워커가 쓸 수 있어 기본을 피한다
const BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });

const home = process.env.USERPROFILE || process.env.HOME || '';
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_CORE || join(home, '.agent-harness', 'vendor', 'gstack', 'node_modules', 'playwright-core'),
);

const results = { steps: {}, consoleErrors: [] };
let step = 'setup';
const log = (...a) => console.log(`[${step}]`, ...a);

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
});
vite.stderr.on('data', d => process.stderr.write(String(d)));

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/');
      if (r.ok) return;
    } catch { /* 아직 안 뜸 */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('vite 서버가 뜨지 않았다');
}

const setDate = (page, value) =>
  page.locator('input[type="date"]').first().evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);

const inputAfterLabel = (page, label) => page.locator(`xpath=//label[normalize-space()="${label}"]/following::input[1]`).first();

async function fillBasic(page) {
  await page.getByRole('button', { name: /기본 정보/ }).first().click();
  await page.waitForTimeout(400);
  await setDate(page, '2026-10-01');
  await page.getByRole('button', { name: '1개월', exact: true }).click();
  await inputAfterLabel(page, '고객사명').fill('(주)한빛물산');
  await inputAfterLabel(page, '고객사 담당자 이름').fill('김민수 팀장');
  await inputAfterLabel(page, '고객사 이메일').fill('minsu.kim@hanbit.example');
  await inputAfterLabel(page, '고객사 연락처').fill('010-2345-6789');
}

async function fillSales(page) {
  await inputAfterLabel(page, '담당자 이니셜').fill('BC');
  await inputAfterLabel(page, '발행 순번').fill('1'); // PDF 저장 검증(ensureValid)이 요구한다
  await inputAfterLabel(page, '영업 담당자 이름').fill('조병철');
  await inputAfterLabel(page, '직책').fill('프로');
  await inputAfterLabel(page, '이메일').fill('bcjo');
  await inputAfterLabel(page, '휴대전화').fill('12345678');
  await inputAfterLabel(page, '직통 번호').fill('8201');
}

async function addItems(page) {
  await page.getByRole('button', { name: /항목/ }).first().click();
  await page.waitForTimeout(400);
  for (const name of ['+ Enterprise 2,000건', '+ 추가 문서', '+ 사용자 교육 1H']) {
    await page.getByRole('button', { name }).click();
    await page.waitForTimeout(250);
  }
  // 첫 항목에 할인율 10% (할인 하나 포함)
  const pct = page.locator('xpath=//span[normalize-space()="할인율"]/following::input[1]').first();
  await pct.fill('10');
  await page.waitForTimeout(400);
}

const previewFacts = page =>
  page.evaluate(() => {
    const el = document.querySelector('#preview-panel');
    const q = s => el?.querySelector(s)?.textContent?.trim() ?? null;
    return {
      exists: !!el,
      quoteMeta: [...(el?.querySelectorAll('.qd-meta .qd-v') ?? [])].map(n => n.textContent.trim()),
      bands: [...(el?.querySelectorAll('.qd-three h3') ?? [])].map(n => n.textContent.trim()),
      customer: el?.querySelectorAll('.qd-three > div')[1]?.innerText?.replace(/\n+/g, ' / ') ?? null,
      contact: el?.querySelectorAll('.qd-three > div')[2]?.innerText?.replace(/\n+/g, ' / ') ?? null,
      itemRows: el?.querySelectorAll('.qd-items tbody tr:not(.qd-cat):not(.qd-empty)').length ?? 0,
      grand: q('.qd-gt .qd-num'),
      editorExpiry: [...document.querySelectorAll('p')].map(p => p.textContent).find(t => t?.startsWith('만료:')) ?? null,
    };
  });

async function editorFacts(page) {
  await page.getByRole('button', { name: /기본 정보/ }).first().click();
  await page.waitForTimeout(400);
  const val = async label => inputAfterLabel(page, label).inputValue();
  return {
    quoteDate: await page.locator('input[type="date"]').first().inputValue(),
    customerName: await val('고객사명'),
    customerManager: await val('고객사 담당자 이름'),
    customerEmail: await val('고객사 이메일'),
    customerContact: await val('고객사 연락처'),
    initials: await val('담당자 이니셜'),
    contactName: await val('영업 담당자 이름'),
    contactTitle: await val('직책'),
  };
}

async function savePreviewStandalone(page, file) {
  const html = await page.evaluate(() => {
    const el = document.querySelector('#preview-panel');
    const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
    return { css, body: el.outerHTML };
  });
  const pub = pathToFileURL(join(ROOT, 'public')).href;
  const fix = s => s.replaceAll('url("/', `url("${pub}/`).replaceAll("url('/", `url('${pub}/`).replaceAll('src="/', `src="${pub}/`);
  writeFileSync(file, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>preview</title><style>${fix(html.css)}</style></head><body style="margin:0;background:#fff">${fix(html.body)}</body></html>`);
}

async function download(page, trigger, savePath) {
  try {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), trigger()]);
    await dl.saveAs(savePath);
    return dl.suggestedFilename();
  } catch (e) {
    const toasts = await page.locator('[data-sonner-toast]').allInnerTexts().catch(() => []);
    results.downloadFailure = { step, toasts, message: String(e).slice(0, 200) };
    await page.screenshot({ path: join(OUT, `fail-${step}.png`) }).catch(() => {});
    throw e;
  }
}

try {
  await waitServer();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await ctx.addInitScript(() => {
      try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch { /* 이미 없음 */ }
    });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') results.consoleErrors.push({ step, text: m.text().slice(0, 300) }); });
    page.on('pageerror', e => results.consoleErrors.push({ step, text: 'pageerror: ' + String(e).slice(0, 300) }));

    // ---- 1. 입력 ----
    step = '1-fill';
    await page.goto(`${BASE}/?bypass-auth`);
    await page.waitForTimeout(2000);
    const skip = page.getByText('건너뛰기');
    if (await skip.count()) await skip.first().click();
    await page.waitForTimeout(300);
    await fillBasic(page);
    await fillSales(page);
    await addItems(page);
    await page.getByRole('button', { name: /기본 정보/ }).first().click();
    await page.waitForTimeout(600);
    results.steps.fill = { preview: await previewFacts(page), editor: await editorFacts(page) };
    await page.screenshot({ path: join(OUT, '01-filled.png') });
    await savePreviewStandalone(page, join(OUT, 'preview-standalone.html'));
    log('preview', JSON.stringify(results.steps.fill.preview));

    // ---- 2. 새로고침 ----
    step = '2-reload';
    await page.reload();
    await page.waitForTimeout(2500);
    const skip2 = page.getByText('건너뛰기');
    if (await skip2.count()) await skip2.first().click();
    await page.waitForTimeout(500);
    results.steps.reload = { preview: await previewFacts(page), editor: await editorFacts(page) };
    await page.screenshot({ path: join(OUT, '02-reload.png') });
    log('reload', JSON.stringify(results.steps.reload));

    // ---- 3. 단일 PDF (새로고침으로 비워진 고객사·견적일을 다시 입력) ----
    step = '3-single-pdf';
    await fillBasic(page);
    results.steps.refill = { preview: await previewFacts(page) };
    const f1 = await download(page, () => page.locator('button[title="PDF / 인쇄"]').click(), join(OUT, 'single.pdf'));
    results.steps.singlePdf = { suggestedFilename: f1 };
    log('single pdf', f1);
    await page.waitForTimeout(800);

    // ---- 4. 멀티 견적(병합 PDF) ----
    step = '4-merged-pdf';
    const openPanel = () => page.locator('button[title^="멀티 견적"]').click();
    const savePanel = async name => {
      await openPanel();
      await page.waitForTimeout(400);
      await page.getByPlaceholder(/견적서 이름/).fill(name);
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await page.waitForTimeout(400);
      await page.locator('h2:has-text("멀티 견적") + button').click();
      await page.waitForTimeout(400);
    };
    await savePanel('견적 A');
    await page.getByRole('button', { name: /기본 정보/ }).first().click();
    await inputAfterLabel(page, '고객사명').fill('(주)두번째상사');
    await page.waitForTimeout(300);
    await savePanel('견적 B');
    await openPanel();
    await page.waitForTimeout(400);
    const boxes = page.locator('ul > li > button');
    const n = await boxes.count();
    for (let i = 0; i < n; i++) {
      const b = boxes.nth(i);
      if ((await b.innerText()).trim() === '' && (await b.evaluate(el => el.className.includes('w-6')))) await b.click();
    }
    await page.waitForTimeout(300);
    const mergeBtn = page.getByRole('button', { name: /병합 PDF/ });
    results.steps.mergedPdf = { mergeButtonLabel: (await mergeBtn.innerText()).trim() };
    const f2 = await download(page, () => mergeBtn.click(), join(OUT, 'merged.pdf'));
    results.steps.mergedPdf.suggestedFilename = f2;
    log('merged pdf', f2);
    await page.waitForTimeout(1500);

    // ---- 5. 초기화 ----
    step = '5-reset';
    await page.locator('button[title="초기화"]').click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: '확인', exact: true }).click();
    await page.waitForTimeout(800);
    results.steps.reset = { preview: await previewFacts(page), editor: await editorFacts(page) };
    await page.screenshot({ path: join(OUT, '04-reset.png') });
    log('reset', JSON.stringify(results.steps.reset));
  } finally {
    await browser.close();
  }
} catch (e) {
  results.error = String(e?.stack ?? e);
  console.error(results.error);
  process.exitCode = 1;
} finally {
  vite.kill();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log('consoleErrors:', results.consoleErrors.length);
}
