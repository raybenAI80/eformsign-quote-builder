// 브라우저 인쇄(Ctrl+P, "PDF로 저장") 결과 검증. print 미디어로 page.pdf 를 만들고 PDF 저장 버튼 결과와 비교한다.
// 시나리오 = 저장 방식(한 장/여러 쪽) x 미리보기(켬/끔) x 품목 수(보통/많음), 대상 = dev 서버·빌드 번들(vite preview).
// 판정: (a) 인쇄 쪽 수 = PDF 버튼 쪽 수  (b) 빈 쪽 없음(비배경 픽셀 비율)  (c) 첫 쪽(여러 쪽은 문서 전체)에 「이폼사인 견적서」·견적번호·합계
//       (d) 편집 패널 문구 없음  (e) 모든 쪽이 A4 세로
// 실행: node --env-file=<.env> --env-file=<.env.local> tools/verify-print.mjs [출력 폴더] [--targets dev,build] [--quick]
//   build 대상은 이 도구가 출력 폴더 안에 따로 빌드(--mode development, ?bypass-auth 가 통하도록)해 vite preview 로 연다. CSS 는 운영처럼 <link> 파일.
//   QB_BASE_URL 이 있으면 그 주소 하나만 'ext' 대상으로 검사한다(verify-export-all 이 쓰는 방식). --quick: 보통 품목 시나리오만.
//   브라우저는 PW_CHROME/CHROME_PATH, 없으면 ms-playwright 의 chrome-headless-shell(resolveChrome). 시스템 python 에 pymupdf(fitz) 필요. 값은 출력하지 않는다.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, loadPlaywright, startVite, fillBasic, fillSales, addItems, downloadTo, launchBrowser, runPython, parseArgs, buildBypassBundle, startPreview, tempBuildDir, dismissOnboarding } from './lib/quote-driver.mjs';

const { positional, flags } = parseArgs(process.argv.slice(2), ['targets']);
const OUT = resolve(positional[0] ?? join(ROOT, '.work', 'verify-print'));
const TARGETS = process.env.QB_BASE_URL ? ['ext'] : String(flags.targets ?? 'dev,build').split(',');
const QUICK = !!flags.quick;
mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();

function analyze(pdfPath, prefix) {
  const r = runPython(['-I', join(ROOT, 'tools', 'lib', 'pdf-pages.py'), pdfPath, prefix]);
  if (r.status !== 0) throw new Error('pdf-pages.py 실패: ' + (r.stderr || r.stdout));
  return JSON.parse(r.stdout).pages;
}

/** 빌드(NODE_ENV=development, ?bypass-auth 통과) 후 vite preview 로 서빙한다. 빌드 폴더는 OS 임시 디렉터리에 둔다. */
async function startBuildPreview(port) {
  const outDir = tempBuildDir('print');
  buildBypassBundle(outDir);
  return startPreview(outDir, port);
}

const MIX = ['+ Enterprise 2,000건', '+ 구독형 Business', '+ 문서 세팅 3건', '+ 추가 문서', '+ 충전형 문서', '+ 계정 구성 지원', '+ 유료 옵션 활용 가능 (10만)', '+ 타임스탬프', '+ 사용자 교육 1H'];
const SCENARIOS = [
  { id: 'fit-on', layout: 'fit', preview: true, many: false },
  { id: 'fit-off', layout: 'fit', preview: false, many: false },
  { id: 'paged-on', layout: 'paged', preview: true, many: false },
  { id: 'paged-off', layout: 'paged', preview: false, many: false },
  { id: 'fit-many', layout: 'fit', preview: true, many: true },
  { id: 'paged-many', layout: 'paged', preview: true, many: true },
].filter(s => !QUICK || !s.many);
const PANEL_WORDS = ['항목 편집', '미리보기', '멀티 견적', '건너뛰기', '옵션 설정'];
const rows = [];
const failures = [];

async function runScenario(browser, base, tag, sc) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript(layout => {
    try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch { /* 이미 없음 */ }
    try { localStorage.setItem('eformsign_quote_pdf_layout', layout); } catch { /* 무시 */ }
  }, sc.layout);
  const page = await ctx.newPage();
  await page.goto(`${base}/?bypass-auth`);
  await dismissOnboarding(page);
  await page.waitForTimeout(300);
  await fillBasic(page);
  await fillSales(page);
  await addItems(page);
  if (sc.many) {
    await page.getByRole('button', { name: /항목/ }).first().click();
    await page.waitForTimeout(400);
    for (let i = 0; i < 14; i++) { await page.getByRole('button', { name: MIX[i % MIX.length] }).first().click(); await page.waitForTimeout(100); }
  }
  await page.getByRole('button', { name: /기본 정보/ }).first().click();
  await page.waitForTimeout(600);
  if (!sc.preview) { await page.locator('button[title="미리보기 토글"]').click(); await page.waitForTimeout(600); }
  await page.waitForTimeout(600); // 여러 쪽 측정이 끝날 때까지

  // PDF 저장 버튼 결과(기준)
  const btnPath = join(OUT, `${tag}-${sc.id}-button.pdf`);
  await downloadTo(page, () => page.locator('button[title="PDF / 인쇄"]').click(), btnPath, 240000);
  const btnPages = analyze(btnPath, join(OUT, `${tag}-${sc.id}-button`));

  // 브라우저 인쇄(print 미디어). Chrome 의 page.pdf 는 beforeprint 를 보내지 않으므로 직접 보낸다.
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  const printPath = join(OUT, `${tag}-${sc.id}-print.pdf`);
  await page.pdf({ path: printPath, preferCSSPageSize: true, printBackground: true });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: null });
  await ctx.close();
  const printPages = analyze(printPath, join(OUT, `${tag}-${sc.id}-print`));

  const label = `${tag}/${sc.id}`;
  const fail = msg => failures.push(`${label}: ${msg}`);
  if (printPages.length !== btnPages.length) fail(`쪽 수 인쇄 ${printPages.length} != PDF 버튼 ${btnPages.length}`);
  printPages.forEach((p, i) => {
    if (p.nonbg < 0.005) fail(`${i + 1}쪽이 빈 쪽이다 (비배경 ${(p.nonbg * 100).toFixed(2)}%)`);
    if (Math.abs(p.w - 595.3) > 3 || Math.abs(p.h - 841.9) > 3) fail(`${i + 1}쪽 크기 ${p.w}x${p.h} 가 A4 세로가 아니다`);
  });
  const first = printPages[0]?.text ?? '';
  const all = printPages.map(p => p.text).join('\n');
  if (!first.includes('이폼사인 견적서')) fail('첫 쪽에 「이폼사인 견적서」 없음');
  if (!/FORCS-[A-Z0-9-]+/.test(first)) fail('첫 쪽에 견적번호 없음');
  if (!(sc.layout === 'fit' ? first : all).includes('합계')) fail('합계 없음');
  for (const w of PANEL_WORDS) if (all.includes(w)) fail(`편집 화면 문구 「${w}」가 인쇄에 나옴`);
  rows.push({ target: tag, scenario: sc.id, printPages: printPages.length, buttonPages: btnPages.length, blank: printPages.filter(p => p.nonbg < 0.005).length, nonbgPct: printPages.map(p => +(p.nonbg * 100).toFixed(1)).join('/') });
}

const browser = await launchBrowser(chromium, { headless: true });
try {
  for (const t of TARGETS) {
    const srv = t === 'dev' ? await startVite(Number(process.env.QB_PORT ?? 3041))
      : t === 'build' ? await startBuildPreview(Number(process.env.QB_PREVIEW_PORT ?? 3042))
      : await startVite(0);
    try {
      for (const sc of SCENARIOS) await runScenario(browser, srv.base, t, sc);
    } finally { srv.stop(); }
  }
} finally {
  await browser.close();
}
console.table(rows);
if (failures.length) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`PASS 인쇄 검증 ${rows.length}건 (대상 ${TARGETS.join(',')})`);
