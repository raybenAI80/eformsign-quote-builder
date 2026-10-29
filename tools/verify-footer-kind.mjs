// 견적서 하단 디자인 자동 선택 브라우저 시나리오 검증.
// 선택 규칙: src/components/preview/quoteFooterKind.ts — 옵션 탭 브랜딩 설정(brandingMode)으로만 정한다.
//   일반 견적서(default)=F2 브랜드 밴드, AI 견적서(ai)·공공 견적서(public)=F1 콜로폰. 항목 탭 sector 는 판정에 쓰지 않는다.
// 시나리오: a 새 견적 기본(카드 순서 일반·공공·AI, 일반 선택, F2) / b 일반 PDF / c 공공 F1 / e AI F1 + 새로고침 유지(d) / f 일반+sector 경로(모두 F2) / g 초기화 후 상태.
//
// 실행 (환경변수는 vite 프로세스에만 필요하며 node 가 파일에서 읽어 이 프로세스로 주입한다. 값은 출력하지 않는다):
//   PW_CHROME=<chrome-headless-shell.exe> node --env-file=<.env> --env-file=<.env.local> tools/verify-footer-kind.mjs <출력 폴더>
// 출력 폴더에 options.png(옵션 탭 카드), a-general-*.png, c-public-*.png, e-ai-*.png, d-reload-*.png, g-reset-*.png, general.pdf, public.pdf, preview-standalone-*.html, results.json 을 쓴다.
// PDF 측정·렌더는 tools/inspect-pdf.py, tools/measure-pdf-alignment.py 가 맡는다.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, '.work', 'verify-footer'));
const PORT = Number(process.env.QB_PORT ?? 3012);
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
  await inputAfterLabel(page, '발행 순번').fill('1');
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
  await page.waitForTimeout(400);
}

const footerFacts = page =>
  page.evaluate(() => {
    const paper = document.querySelector('#preview-panel');
    const foot = paper?.querySelector('.qd-foot');
    const pr = paper?.getBoundingClientRect();
    const fr = foot?.getBoundingClientRect();
    return {
      kind: foot?.getAttribute('data-footer') ?? null,
      title: paper?.querySelector('.qd-title')?.textContent?.trim() ?? null,
      footHeight: fr ? Math.round(fr.height * 100) / 100 : null,
      paperHeight: pr ? Math.round(pr.height * 100) / 100 : null,
      images: foot ? [...foot.querySelectorAll('img')].map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })) : [],
      text: foot?.innerText?.replace(/\s+/g, ' ').trim() ?? null,
    };
  });

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

async function capture(page, prefix) {
  const paper = page.locator('#preview-panel').first();
  await paper.scrollIntoViewIfNeeded();
  await paper.screenshot({ path: join(OUT, `${prefix}-paper.png`) });
  await page.locator('#preview-panel .qd-foot').first().screenshot({ path: join(OUT, `${prefix}-foot.png`) });
  await page.screenshot({ path: join(OUT, `${prefix}-screen.png`) });
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

const gotoOptions = async page => {
  await page.getByRole('button', { name: /옵션 설정/ }).first().click();
  await page.waitForTimeout(400);
};
// 옵션 탭 「브랜딩 설정」 카드의 표시 순서와 선택 상태(선택된 카드에만 체크 svg 가 있다).
const brandingCards = page =>
  page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find(e => e.textContent.trim() === '브랜딩 설정');
    const grid = h?.parentElement?.querySelector('.grid');
    return [...(grid?.querySelectorAll('button') ?? [])].map(b => ({
      label: b.querySelector('.font-bold')?.textContent?.trim() ?? null,
      selected: !!b.querySelector('svg'),
    }));
  });
const pickBranding = async (page, label) => {
  await gotoOptions(page);
  await page.getByRole('button', { name: new RegExp(label) }).first().click();
  await page.waitForTimeout(500);
};
const pickSector = async (page, label) => {
  await page.getByRole('button', { name: /항목/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(500);
};

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

    // ---- a. 일반(기본값) 입력 → F2 ----
    step = 'a-general';
    await page.goto(`${BASE}/?bypass-auth`);
    await page.waitForTimeout(2000);
    const skip = page.getByText('건너뛰기');
    if (await skip.count()) await skip.first().click();
    await page.waitForTimeout(300);
    await gotoOptions(page);
    results.steps.a0 = { cards: await brandingCards(page) };
    await page.locator('h2', { hasText: '브랜딩 설정' }).locator('xpath=..').screenshot({ path: join(OUT, 'options.png') });
    log(JSON.stringify(results.steps.a0));
    await fillBasic(page);
    await fillSales(page);
    await addItems(page);
    await page.getByRole('button', { name: /기본 정보/ }).first().click();
    await page.waitForTimeout(600);
    results.steps.a = await footerFacts(page);
    await capture(page, 'a-general');
    await savePreviewStandalone(page, join(OUT, 'preview-standalone-general.html'));
    log(JSON.stringify(results.steps.a));

    // ---- b. 일반 단일 PDF ----
    step = 'b-general-pdf';
    results.steps.b = { suggestedFilename: await download(page, () => page.locator('button[title="PDF / 인쇄"]').click(), join(OUT, 'general.pdf')) };
    log(results.steps.b.suggestedFilename);
    await page.waitForTimeout(800);

    // ---- c. 공공으로 바꾸기 → F1 (옵션 설정의 「공공 견적서」 = brandingMode) ----
    step = 'c-public';
    await pickBranding(page, '공공 견적서');
    results.steps.c = await footerFacts(page);
    await capture(page, 'c-public');
    await savePreviewStandalone(page, join(OUT, 'preview-standalone-public.html'));
    log(JSON.stringify(results.steps.c));
    results.steps.cPdf = { suggestedFilename: await download(page, () => page.locator('button[title="PDF / 인쇄"]').click(), join(OUT, 'public.pdf')) };
    await page.waitForTimeout(800);

    // ---- e. AI 견적서 → F1 (제목에 AI 아이콘) ----
    step = 'e-ai';
    await pickBranding(page, 'AI 견적서');
    results.steps.e = await footerFacts(page);
    results.steps.eCards = await brandingCards(page);
    results.steps.eTitleHasAiIcon = await page.locator('#preview-panel .qd-title img[alt="AI"]').count();
    await capture(page, 'e-ai');
    log(JSON.stringify(results.steps.e), 'aiIcon=' + results.steps.eTitleHasAiIcon);

    // ---- d. 새로고침 → AI 상태와 F1 유지 ----
    step = 'd-reload';
    await page.reload();
    await page.waitForTimeout(2500);
    const skip2 = page.getByText('건너뛰기');
    if (await skip2.count()) await skip2.first().click();
    await page.waitForTimeout(500);
    results.steps.d = await footerFacts(page);
    results.steps.dTitleHasAiIcon = await page.locator('#preview-panel .qd-title img[alt="AI"]').count();
    results.steps.dCards = await brandingCards(page).catch(() => null);
    await capture(page, 'd-reload');
    log(JSON.stringify(results.steps.d));

    // ---- f. 보조: sector 경로 (브랜딩 「일반 견적서」 + 항목 탭 sector) ----
    step = 'f-sector';
    await pickBranding(page, '일반 견적서');
    results.steps.fDefault = await footerFacts(page);
    await pickSector(page, '정부·공공기관용');
    results.steps.fSectorPublic = await footerFacts(page);
    await pickSector(page, '지원사업용');
    results.steps.fSectorSubsidy = await footerFacts(page);
    await pickSector(page, '일반 기업용');
    results.steps.fSectorGeneral = await footerFacts(page);
    log(['fDefault', 'fSectorPublic', 'fSectorSubsidy', 'fSectorGeneral'].map(k => `${k}=${results.steps[k].kind}`).join(' '));

    // ---- g. AI 견적서로 바꾼 뒤 초기화 → 브랜딩과 하단 ----
    step = 'g-reset';
    await pickBranding(page, 'AI 견적서');
    results.steps.gBefore = await footerFacts(page);
    await page.locator('button[title="초기화"]').first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: '확인', exact: true }).click();
    await page.waitForTimeout(800);
    results.steps.g = await footerFacts(page);
    await gotoOptions(page);
    results.steps.gCards = await brandingCards(page);
    await capture(page, 'g-reset');
    log('before=' + results.steps.gBefore.kind, 'after=' + results.steps.g.kind, JSON.stringify(results.steps.gCards));
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
