// 결제 정보 블록(Enterprise 견적에서만 표시) 브라우저 시나리오 검증.
// 시나리오: A) Enterprise 포함 → 미리보기·PDF 에 보임 / B) Enterprise 없음 → 둘 다 없음, 합계 영역 배치 /
//          C) 26건(Enterprise 없음) 여러 쪽 → 잘린 행 0 / D) 26건(Enterprise 포함) 여러 쪽 /
//          E) 병합 PDF(Enterprise 견적 + 없는 견적) / F) 기록 탭 스냅샷 미리보기 → 현재 견적이 아니라 스냅샷 기준.
// 결과: <출력 폴더>/results.json, *.pdf, *.png.
//
// 실행: PW_CHROME=<chrome-headless-shell.exe> PYI=<python> node --env-file=<.env> --env-file=<.env.local> tools/verify-payment-info.mjs <출력 폴더>
// 환경변수 파일의 값은 vite 프로세스에만 쓰이며 출력하지 않는다.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, startVite, downloadTo, fillBasic, fillSales } from './lib/quote-driver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv.slice(2).find(a => !a.startsWith('--')) ?? '.work/verify-payment-info');
const PY = process.env.PYI ?? 'python';
mkdirSync(OUT, { recursive: true });

const results = { steps: {}, consoleErrors: [] };
const log = (k, v) => { results.steps[k] = v; console.log(`[${k}]`, JSON.stringify(v)); };

const ENT = ['+ Enterprise 2,000건', '+ 추가 문서', '+ 사용자 교육 1H'];
const NON_ENT = ['+ 구독형 Business', '+ 충전형 문서', '+ 사용자 교육 1H'];
// 구분 세 개와 노트 길이가 다른 행을 섞는다 (Enterprise 없음)
const MIX_NON_ENT = ['+ 구독형 Business', '+ 문서 세팅 3건', '+ 추가 문서', '+ 충전형 문서', '+ 계정 구성 지원', '+ 유료 옵션 활용 가능 (10만)', '+ 타임스탬프', '+ 사용자 교육 1H'];

const gotoTab = async (page, re) => { await page.getByRole('button', { name: re }).first().click(); await page.waitForTimeout(400); };
async function addMany(page, names, count, delay = 100) {
  await gotoTab(page, /항목/);
  for (let i = 0; i < count; i++) {
    await page.getByRole('button', { name: names[i % names.length] }).first().click();
    await page.waitForTimeout(delay);
  }
}
const pdfBtn = page => page.locator('button[title="PDF / 인쇄"]');
const caretBtn = page => page.locator('button[aria-label="PDF 저장 방식 선택"]');
const savePdf = (page, name) => downloadTo(page, () => pdfBtn(page).click(), join(OUT, name), 240000);
async function choosePaged(page) {
  await caretBtn(page).click();
  await page.waitForSelector('[role="menu"]');
  await page.getByRole('menuitemradio', { name: /여러 쪽으로 나눠 저장/ }).click();
  await page.waitForTimeout(600);
}

/** PDF 쪽별로 '결제 정보'·'신한은행'·'사업자등록증' 적중 수와 쪽수 */
function pdfPay(pdf) {
  const r = spawnSync(PY, [join(HERE, 'inspect-pdf.py'), pdf, '--find', '결제 정보', '신한은행', '사업자등록증'], { encoding: 'utf8' });
  const pages = Number(/pages=(\d+)/.exec(r.stdout)?.[1] ?? 0);
  const out = [];
  let cur = null;
  for (const line of r.stdout.split(/\r?\n/)) {
    const m = /^page (\d+):/.exec(line);
    if (m) { cur = { page: +m[1], hits: {} }; out.push(cur); continue; }
    const s = /search '(.+?)': (\d+) hit/.exec(line);
    if (s && cur) cur.hits[s[1]] = +s[2];
  }
  return { pages, perPage: out, ok: r.status === 0 };
}

/** 미리보기 쪽(.qd-page 또는 단일 용지) 진단: 결제 칸 유무, 합계 칸 위치, 잘림 */
const previewDiag = (page, root = 'aside') => page.evaluate(root => {
  const R = document.querySelector(root);
  const pay = R.querySelectorAll('.qd-pay').length;
  const sm = R.querySelector('.qd-sm');
  const sum = R.querySelector('.qd-sumrow');
  const paper = sm?.closest('.qd-paper, .qd-page');
  const smR = sm?.getBoundingClientRect();
  const paperR = paper?.getBoundingClientRect();
  const pages = [...R.querySelectorAll('.qd-page')].map((pg, i) => ({
    page: i + 1, clipped: pg.scrollHeight - pg.clientHeight, hasSum: !!pg.querySelector('.qd-sumrow'), hasPay: !!pg.querySelector('.qd-pay'),
    items: pg.querySelectorAll('table.qd-items tbody tr:not(.qd-cat)').length,
  }));
  return {
    payBlocks: pay,
    sumPresent: !!sum,
    smRightGap: smR && paperR ? Math.round(paperR.right - smR.right) : null,
    smWidth: smR ? Math.round(smR.width) : null,
    sumHeight: sum ? Math.round(sum.getBoundingClientRect().height) : null,
    pages,
  };
}, root);

async function open(browser, base, customer) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  await ctx.addInitScript(() => { try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch { /* 없음 */ } });
  const page = await ctx.newPage();
  await page.goto(`${base}/?bypass-auth`);
  await page.waitForTimeout(2000);
  const skip = page.getByText('건너뛰기');
  if (await skip.count()) await skip.first().click();
  await page.waitForTimeout(300);
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' });
  page.on('console', m => { if (m.type() === 'error') results.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => results.consoleErrors.push('pageerror: ' + String(e).slice(0, 300)));
  await fillBasic(page, customer);
  await fillSales(page);
  return { ctx, page };
}

const shotSum = async (page, file) => {
  const loc = page.locator('aside .qd-sumrow').last();
  await loc.scrollIntoViewIfNeeded();
  await loc.screenshot({ path: join(OUT, file) });
};

const { chromium } = loadPlaywright();
const vite = await startVite(Number(process.env.QB_PORT ?? 3015));
try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    // A. Enterprise 포함 (한 장)
    {
      const { ctx, page } = await open(browser, vite.base, '(주)엔터A');
      await addMany(page, ENT, 3, 250);
      await gotoTab(page, /기본 정보/);
      await page.waitForTimeout(600);
      await savePdf(page, 'A-enterprise.pdf');
      log('A-enterprise', { preview: await previewDiag(page), pdf: pdfPay(join(OUT, 'A-enterprise.pdf')) });
      await shotSum(page, 'A-enterprise-sum.png');
      await page.locator('aside').first().screenshot({ path: join(OUT, 'A-enterprise-preview.png') });
      await ctx.close();
    }

    // B. Enterprise 없음 (한 장)
    {
      const { ctx, page } = await open(browser, vite.base, '(주)일반B');
      await addMany(page, NON_ENT, 3, 250);
      await gotoTab(page, /기본 정보/);
      await page.waitForTimeout(600);
      await savePdf(page, 'B-no-enterprise.pdf');
      log('B-no-enterprise', { preview: await previewDiag(page), pdf: pdfPay(join(OUT, 'B-no-enterprise.pdf')) });
      await shotSum(page, 'B-no-enterprise-sum.png');
      await page.locator('aside').first().screenshot({ path: join(OUT, 'B-no-enterprise-preview.png') });

      // F. 기록 탭: 이 견적(Enterprise 없음)을 스냅샷으로 저장 → Enterprise 를 추가한 뒤 스냅샷을 미리보기하면 결제 정보가 없어야 한다
      await gotoTab(page, /기록/);
      await page.getByPlaceholder(/현재 버전 메모/).fill('스냅샷-Enterprise없음');
      await page.getByRole('button', { name: /현재 버전 저장/ }).click();
      await page.waitForTimeout(500);
      await gotoTab(page, /항목/);
      await page.getByRole('button', { name: '+ Enterprise 2,000건' }).click();
      await page.waitForTimeout(400);
      const current = await previewDiag(page);
      await gotoTab(page, /기록/);
      const row = page.locator('div.group', { hasText: '스냅샷-Enterprise없음' }).first();
      await row.hover();
      await row.locator('button[title="미리보기"]').click();
      await page.waitForTimeout(600);
      const snap = await previewDiag(page);
      log('F-history-snapshot', { currentHasEnterprise: current.payBlocks, snapshotPreviewPayBlocks: snap.payBlocks });
      await row.locator('button[title="미리보기 종료"]').click().catch(() => {});
      await ctx.close();
    }

    // C. 26건 Enterprise 없음, 여러 쪽
    {
      const { ctx, page } = await open(browser, vite.base, '(주)쪽나눔C');
      await addMany(page, MIX_NON_ENT, 26, 110);
      await gotoTab(page, /기본 정보/);
      await choosePaged(page); // 이 클릭이 곧 저장이다
      await page.waitForTimeout(800);
      await savePdf(page, 'C-paged-26-no-enterprise.pdf');
      log('C-paged26-no-enterprise', { preview: await previewDiag(page), hidden: await previewDiag(page, '#pdf-pages-panel'), pdf: pdfPay(join(OUT, 'C-paged-26-no-enterprise.pdf')) });
      await shotSum(page, 'C-paged26-sum.png');
      await ctx.close();
    }

    // D. 26건 Enterprise 포함, 여러 쪽 (맨 앞에 Enterprise)
    {
      const { ctx, page } = await open(browser, vite.base, '(주)쪽나눔D');
      await addMany(page, ['+ Enterprise 2,000건', ...MIX_NON_ENT], 26, 110);
      await gotoTab(page, /기본 정보/);
      await choosePaged(page);
      await page.waitForTimeout(800);
      await savePdf(page, 'D-paged-26-enterprise.pdf');
      log('D-paged26-enterprise', { preview: await previewDiag(page), hidden: await previewDiag(page, '#pdf-pages-panel'), pdf: pdfPay(join(OUT, 'D-paged-26-enterprise.pdf')) });
      await shotSum(page, 'D-paged26-sum.png');
      await ctx.close();
    }

    // E. 병합 PDF: 견적1(Enterprise) + 견적2(Enterprise 없음)
    {
      const { ctx, page } = await open(browser, vite.base, '(주)병합1');
      const saveMulti = async name => {
        await page.getByRole('button', { name: /멀티 견적/ }).first().click();
        await page.getByPlaceholder(/견적서 이름/).fill(name);
        await page.getByRole('button', { name: '저장', exact: true }).click();
        await page.waitForTimeout(500);
      };
      await addMany(page, ENT, 3, 200);
      await saveMulti('견적1-Enterprise');
      await page.getByRole('button', { name: '닫기' }).click();
      await page.getByRole('button', { name: /초기화/ }).first().click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /^초기화$|계속|확인/ }).last().click().catch(() => {});
      await page.waitForTimeout(500);
      await fillBasic(page, '(주)병합2');
      await fillSales(page);
      await addMany(page, NON_ENT, 3, 200);
      await saveMulti('견적2-일반');
      for (const nm of ['견적1-Enterprise', '견적2-일반']) {
        await page.locator('li', { hasText: nm }).locator('button').first().click();
        await page.waitForTimeout(150);
      }
      await downloadTo(page, () => page.getByRole('button', { name: /병합 PDF/ }).last().click(), join(OUT, 'E-merged.pdf'), 300000);
      log('E-merged', { pdf: pdfPay(join(OUT, 'E-merged.pdf')) });
      await ctx.close();
    }

    results.consoleErrorCount = results.consoleErrors.length;
    writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
    console.log('consoleErrors', results.consoleErrors.length);
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
}
