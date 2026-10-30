// Business 구독형 초과 단가 문구 검증 (2027-01-01 부터 600원/건 → 800원/건, 견적일 기준 자동 전환).
// 구독형 Business·Personal 품목을 넣고 견적일을 2026-12-15 / 2026-12-31 / 2027-01-01 로 바꿔 가며
// 미리보기 비고, PDF 텍스트 레이어, 줄 나눔(어색한 꺾임 없음)을 기대값과 대조한다. 기대와 다르면 exit 1.
// 실행: PW_CHROME=<chrome-headless-shell.exe> node --env-file=<env 파일> tools/verify-business-overage.mjs <출력 폴더>
//   (QB_BASE_URL 이 있으면 vite 를 새로 띄우지 않는다. verify:export 가 쓴다)
// 결과: <출력 폴더>/overage-<날짜>.png(미리보기 품목 표), overage-<날짜>.pdf, overage-<날짜>-pdf.png(PDF 1쪽), results.json
// PDF 글자 추출은 시스템 python 의 pymupdf(fitz)를 쓴다(PYI 는 비운다).
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { loadPlaywright, startVite, fillBasic, fillSales, downloadTo } from './lib/quote-driver.mjs';

const OUT = resolve(process.argv[2] ?? '.work/verify-business-overage');
mkdirSync(OUT, { recursive: true });
const { chromium } = loadPlaywright();
const results = { steps: {}, failures: [] };
delete process.env.PYI;

const BEFORE = '(초과 시 600원/건, 2027년 1월 1일부터 800원/건)';
const AFTER = '(초과 시 800원/건)';
const PERSONAL = '(초과 시 1,000원/건)';
// [견적일, Business 비고에 있어야 하는 문구, 있으면 안 되는 문구]
const CASES = [
  ['2026-12-15', BEFORE, [AFTER]],
  ['2026-12-31', BEFORE, [AFTER]],
  ['2027-01-01', AFTER, ['600원', '2027년 1월 1일부터']],
];

const norm = s => s.replace(/\s+/g, ' ').trim();
const fail = (key, msg) => results.failures.push(`${key}: ${msg}`);

function pdfText(file) {
  const py = 'import sys,json,fitz;d=fitz.open(sys.argv[1]);print(json.dumps([p.get_text() for p in d]))';
  const r = spawnSync('python', ['-c', py, file], { encoding: 'utf8', env: process.env });
  if (r.status !== 0) throw new Error(`PDF 글자 추출 실패: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

// PDF 1쪽을 PNG 로 저장한다(눈으로 줄 나눔을 확인하는 용도)
function pdfPagePng(file, png) {
  const py = 'import sys,fitz;d=fitz.open(sys.argv[1]);d[0].get_pixmap(matrix=fitz.Matrix(2,2),alpha=False).save(sys.argv[2])';
  const r = spawnSync('python', ['-c', py, file, png], { encoding: 'utf8', env: process.env });
  if (r.status !== 0) throw new Error(`PDF 렌더 실패: ${r.stderr}`);
}

const setQuoteDate =async (page, value) => {
  await page.getByRole('button', { name: /기본 정보/ }).first().click();
  await page.waitForTimeout(400);
  await page.locator('input[type="date"]').first().evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await page.waitForTimeout(500);
};

// 화면 미리보기 / PDF 캡처용 숨김 렌더 양쪽에서 품목별 비고 글자와 그려진 줄 수를 읽는다
const readNotes = (page, root) => page.evaluate(root => {
  const paper = document.querySelector(root);
  const out = {};
  for (const td of paper.querySelectorAll('td.qd-item')) {
    const name = td.querySelector('b')?.innerText.trim();
    const note = td.querySelector('.qd-note');
    if (!name || !note) continue;
    const r = document.createRange();
    r.selectNodeContents(note);
    const lines = new Set([...r.getClientRects()].filter(q => q.width > 0).map(q => Math.round(q.top))).size;
    out[name] = { text: note.innerText, lines, expectedLines: note.innerText.split('\n').length };
  }
  return out;
}, root);

const vite = await startVite(Number(process.env.QB_PORT ?? 3020));
try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
    await ctx.addInitScript(() => { try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch { /* 이미 없음 */ } });
    const page = await ctx.newPage();
    await page.goto(`${vite.base}/?bypass-auth`);
    await page.waitForTimeout(2000);
    const skip = page.getByText('건너뛰기');
    if (await skip.count()) await skip.first().click();
    await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' });
    await fillBasic(page);
    await fillSales(page);
    await page.getByRole('button', { name: /항목/ }).first().click();
    await page.waitForTimeout(400);
    for (const name of ['+ 구독형 Business', '+ 구독형 Personal']) {
      await page.getByRole('button', { name }).first().click();
      await page.waitForTimeout(300);
    }

    for (const [date, want, forbid] of CASES) {
      const key = `date-${date}`;
      await setQuoteDate(page, date);
      const screen = await readNotes(page, '#preview-panel');
      const pdfView = await readNotes(page, '#pdf-preview-panel .qd-paper');
      const pdfFile = join(OUT, `overage-${date}.pdf`);
      const dl = await downloadTo(page, () => page.locator('button[title="PDF / 인쇄"]').click(), pdfFile, 240000);
      pdfPagePng(pdfFile, join(OUT, `overage-${date}-pdf.png`));
      const text = norm(pdfText(pdfFile).join('\n'));
      const biz = screen['구독형 Business']?.text ?? '';
      const per = screen['구독형 Personal']?.text ?? '';
      results.steps[key] = { screenBusiness: biz.split('\n')[0], screenPersonal: per.split('\n')[0], pdfFile: dl.name, pdfHasBusiness: text.includes(want), screenLines: screen['구독형 Business'], pdfViewLines: pdfView['구독형 Business'] };

      for (const [where, notes] of [['미리보기', screen], ['PDF 렌더', pdfView]]) {
        const b = notes['구독형 Business'];
        if (!b) { fail(key, `${where}: Business 비고를 찾지 못함`); continue; }
        if (!norm(b.text).includes(want)) fail(key, `${where} Business 비고에 ${want} 없음: ${b.text.split('\n')[0]}`);
        for (const f of forbid) if (b.text.includes(f)) fail(key, `${where} Business 비고에 있으면 안 되는 문구 ${f}`);
        if (b.lines !== b.expectedLines) fail(key, `${where} Business 비고가 ${b.lines}줄로 그려짐(문단 ${b.expectedLines}줄, 어색한 꺾임)`);
        if (!norm(notes['구독형 Personal']?.text ?? '').includes(PERSONAL)) fail(key, `${where} Personal 비고에 ${PERSONAL} 없음(바뀌면 안 됨)`);
      }
      if (!text.includes(want)) fail(key, `PDF 글자에 ${want} 없음`);
      for (const f of forbid) if (text.includes(f)) fail(key, `PDF 글자에 있으면 안 되는 문구 ${f}`);
      if (!text.includes(PERSONAL)) fail(key, `PDF 글자에 Personal ${PERSONAL} 없음`);

      await page.locator('#preview-panel .qd-items').first().screenshot({ path: join(OUT, `overage-${date}.png`) });
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 1));
}
if (results.failures.length) { console.error('FAIL', results.failures); process.exit(1); }
console.log('OK business-overage');
