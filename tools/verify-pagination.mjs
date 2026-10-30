// PDF 쪽 구성(한 장 / 여러 쪽) 브라우저 시나리오 검증. 단위 테스트만으로는 알 수 없는 것(실제 쪽 DOM, 저장된 PDF, 메뉴 동작, 기억)을 잰다.
// 시나리오: 한 장 3건 → 메뉴 → 여러 쪽 3건 → 26건 여러 쪽 → 한 장 26건 → 새로고침 기억 → 50건·1줄 행 섞임·공공 → 병합 PDF.
// 결과: <출력 폴더>/results.json, *.pdf, *.png. PDF 분석은 tools/inspect-pdf.py, tools/measure-pdf-alignment.py 가 맡는다(PYI=python 경로).
//
// 실행: PW_CHROME=<chrome-headless-shell.exe> PYI=<python> node --env-file=<.env> --env-file=<.env.local> tools/verify-pagination.mjs <출력 폴더> [--only a,b,...]
// 환경변수 파일의 값은 vite 프로세스에만 쓰이며 출력하지 않는다.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, startVite, openAndFill, downloadTo, fillBasic, fillSales, addItems } from './lib/quote-driver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const OUT = resolve(args.find(a => !a.startsWith('--')) ?? '.work/verify-pagination');
const onlyArg = args.indexOf('--only');
const ONLY = onlyArg >= 0 ? new Set(args[onlyArg + 1].split(',')) : null;
const PY = process.env.PYI ?? 'python';
mkdirSync(OUT, { recursive: true });

const results = { steps: {}, consoleErrors: [] };
const want = k => !ONLY || ONLY.has(k);
const log = (k, v) => { results.steps[k] = v; console.log(`[${k}]`, JSON.stringify(v)); };

const py = (script, argv) => spawnSync(PY, [join(HERE, script), ...argv], { encoding: 'utf8', shell: false });
function pdfFacts(pdf) {
  const r = py('inspect-pdf.py', [pdf, '--find', '/ ']);
  const pages = Number(/pages=(\d+)/.exec(r.stdout)?.[1] ?? 0);
  const sizes = [...r.stdout.matchAll(/page (\d+): ([\d.]+)x([\d.]+)mm chars=(\d+)/g)].map(m => ({ page: +m[1], w: +m[2], h: +m[3], chars: +m[4] }));
  const dy = [];
  for (let p = 1; p <= pages; p++) {
    const a = py('measure-pdf-alignment.py', [pdf, '--dpi', '200', '--page', String(p)]);
    dy.push({ page: p, lines: Number(/measured lines=(\d+)/.exec(a.stdout)?.[1] ?? 0), dy: /dy: median=([+-][\d.]+)mm/.exec(a.stdout)?.[1] ?? null, dxRight: /dx_right: median=([+-][\d.]+)mm/.exec(a.stdout)?.[1] ?? null });
  }
  const txt = py('inspect-pdf.py', [pdf]).stdout;
  return { pages, sizes, dy, ok: r.status === 0 && txt.length > 0 };
}

// 쪽 DOM 진단(브라우저 안에서 실행)
const pagesDiag = (page, root) => page.evaluate(root => {
  const R = document.querySelector(root);
  if (!R) return null;
  return [...R.querySelectorAll('.qd-page')].map((pg, i) => {
    const pr = pg.getBoundingClientRect();
    const body = pg.querySelector('.qd-body');
    const kids = [...body.children];
    const lastKid = kids[kids.length - 1];
    const trs = [...pg.querySelectorAll('table.qd-items tbody tr')];
    const rows = trs.map(tr => ({ cat: tr.classList.contains('qd-cat'), text: tr.querySelector('td').textContent.trim() }));
    const foot = pg.querySelector('.qd-foot');
    const tail = pg.querySelector('.qd-notes') ?? pg.querySelector('.qd-sumrow');
    const pn = pg.querySelector('.qd-pageno');
    const tbl = pg.querySelector('table.qd-items').getBoundingClientRect();
    return {
      page: i + 1, w: pg.offsetWidth, h: pg.offsetHeight,
      head: pg.querySelector('.qd-titlebar') ? 'full' : pg.querySelector('.qd-thin') ? 'thin' : 'none',
      items: rows.filter(r => !r.cat).length, cats: rows.filter(r => r.cat).map(r => r.text),
      firstRow: rows[0]?.text ?? null, lastRowIsCat: rows.length ? rows[rows.length - 1].cat : null,
      hasSum: !!pg.querySelector('.qd-sumrow'), hasNotes: !!pg.querySelector('.qd-notes'),
      footKind: foot?.dataset.footer ?? null, pageNo: pn?.textContent ?? null,
      clipped: pg.scrollHeight - pg.clientHeight, // > 0 이면 잘린 내용이 있다
      tableBottomGap: Math.round(pr.bottom - tbl.bottom),
      tailToFoot: foot && tail ? Math.round(foot.getBoundingClientRect().top - tail.getBoundingClientRect().bottom) : null,
      contentBottomGap: Math.round(pr.bottom - lastKid.getBoundingClientRect().bottom),
      footTopFromBottom: foot ? Math.round(pr.bottom - foot.getBoundingClientRect().top) : null,
    };
  });
}, root);

const QUICK = ['+ Enterprise 2,000건', '+ 추가 문서', '+ 사용자 교육 1H'];
// 노트 길이가 다른 행(1줄·2줄·8줄)과 구분 세 개(문서·크레딧·프리미엄 서비스)를 섞는다
const MIX = ['+ Enterprise 2,000건', '+ 구독형 Business', '+ 문서 세팅 3건', '+ 추가 문서', '+ 충전형 문서', '+ 계정 구성 지원', '+ 유료 옵션 활용 가능 (10만)', '+ 타임스탬프', '+ 사용자 교육 1H'];
const gotoTab = async (page, re) => { await page.getByRole('button', { name: re }).first().click(); await page.waitForTimeout(400); };
async function addMany(page, names, from, to, delay = 100) {
  await gotoTab(page, /항목/);
  for (let i = from; i < to; i++) {
    await page.getByRole('button', { name: names[i % names.length] }).first().click();
    await page.waitForTimeout(delay);
  }
}
const pdfBtn = page => page.locator('button[title="PDF / 인쇄"]');
const caretBtn = page => page.locator('button[aria-label="PDF 저장 방식 선택"]');
const savePdf = (page, name) => downloadTo(page, () => pdfBtn(page).click(), join(OUT, name), 240000);
async function chooseMenu(page, title, name) {
  await caretBtn(page).click();
  await page.waitForSelector('[role="menu"]');
  return downloadTo(page, () => page.getByRole('menuitemradio', { name: new RegExp(title) }).click(), join(OUT, name), 240000);
}
const storedPref = page => page.evaluate(() => localStorage.getItem('eformsign_quote_pdf_layout'));
const previewMode = page => page.evaluate(() => ({
  pagesInPreview: document.querySelectorAll('aside .qd-pages-screen .qd-page').length,
  singleInPreview: !!document.querySelector('aside #preview-panel'),
}));
const pickBranding = async (page, label) => {
  await gotoTab(page, /옵션 설정/);
  await page.getByRole('button', { name: new RegExp(label) }).first().click();
  await page.waitForTimeout(500);
};
async function shotPreview(page, file) {
  await page.locator('aside').first().screenshot({ path: join(OUT, file) });
}

const { chromium } = loadPlaywright();
const vite = await startVite(Number(process.env.QB_PORT ?? 3014));
try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    const { ctx, page } = await openAndFill(browser, vite.base);
    let step = 'setup';
    await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' }); // 스크린샷에 토스트가 겹치지 않게
    page.on('console', m => { if (m.type() === 'error') results.consoleErrors.push({ step, text: m.text().slice(0, 300) }); });
    page.on('pageerror', e => results.consoleErrors.push({ step, text: 'pageerror: ' + String(e).slice(0, 300) }));

    // 1. 기본값 = 한 장. 품목 3건 한 장 PDF
    step = 'fit3';
    log('pref-initial', { stored: await storedPref(page), preview: await previewMode(page) });
    log('fit3', { dl: await savePdf(page, 'fit-3.pdf'), pdf: pdfFacts(join(OUT, 'fit-3.pdf')) });

    // 2. 메뉴: 열기·부제·Esc·바깥 클릭
    step = 'menu';
    await page.waitForTimeout(500);
    await caretBtn(page).click();
    await page.waitForSelector('[role="menu"]');
    const menuText = await page.locator('[role="menu"]').innerText();
    const expanded = await caretBtn(page).getAttribute('aria-expanded');
    await page.screenshot({ path: join(OUT, 'menu-open-3items.png'), clip: { x: 700, y: 0, width: 740, height: 320 } });
    const checked = await page.$$eval('[role="menuitemradio"]', els => els.map(e => ({ t: e.innerText.split('\n')[0], checked: e.getAttribute('aria-checked') })));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const afterEsc = { menu: await page.locator('[role="menu"]').count(), expanded: await caretBtn(page).getAttribute('aria-expanded'), focusOnCaret: await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) };
    await caretBtn(page).click();
    await page.waitForSelector('[role="menu"]');
    await page.mouse.click(300, 600);
    await page.waitForTimeout(200);
    const afterOutside = { menu: await page.locator('[role="menu"]').count() };
    await caretBtn(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForSelector('[role="menu"]');
    const kbd = await page.evaluate(() => document.activeElement?.innerText?.split('\n')[0]);
    await page.keyboard.press('ArrowDown');
    const kbd2 = await page.evaluate(() => document.activeElement?.innerText?.split('\n')[0]);
    await page.keyboard.press('Escape');
    log('menu', { menuText, expanded, checked, afterEsc, afterOutside, kbd, kbd2 });

    // 3. 메뉴에서 "여러 쪽" 선택 → 3건은 1쪽(쪽 번호 없음), 기억
    step = 'paged3';
    const d3 = await chooseMenu(page, '여러 쪽으로 나눠 저장', 'paged-3.pdf');
    await page.waitForTimeout(600);
    log('paged3', { dl: d3, stored: await storedPref(page), pdf: pdfFacts(join(OUT, 'paged-3.pdf')), pages: await pagesDiag(page, '#pdf-pages-panel'), preview: await previewMode(page) });

    // 4. 26건 여러 쪽 (일반 견적서): PDF 본 버튼이 기억된 방식으로 저장
    step = 'paged26';
    await addMany(page, QUICK, 3, 26, 120);
    await gotoTab(page, /기본 정보/);
    await page.waitForTimeout(800);
    await caretBtn(page).click();
    await page.waitForSelector('[role="menu"]');
    const menu26 = await page.locator('[role="menu"]').innerText();
    await page.screenshot({ path: join(OUT, 'menu-open-26items.png'), clip: { x: 700, y: 0, width: 740, height: 320 } });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await shotPreview(page, 'preview-paged-26.png');
    log('paged26', {
      menu: menu26,
      dl: await savePdf(page, 'paged-26.pdf'),
      pdf: pdfFacts(join(OUT, 'paged-26.pdf')),
      pagesHidden: await pagesDiag(page, '#pdf-pages-panel'),
      pagesPreview: await pagesDiag(page, 'aside'),
      preview: await previewMode(page),
    });

    // 4b. PNG 는 저장 방식과 무관하게 한 장 이미지 (여러 쪽 모드에서도)
    step = 'png';
    const pngDl = await downloadTo(page, () => page.locator('button[title="PNG 이미지로 저장"]').click(), join(OUT, 'png-in-paged-mode.png'), 120000);
    const pngDim = (await import('node:fs')).readFileSync(join(OUT, 'png-in-paged-mode.png')).subarray(16, 24);
    log('png-in-paged-mode', { dl: pngDl, width: pngDim.readUInt32BE(0), height: pngDim.readUInt32BE(4),
      paperH: await page.evaluate(() => document.querySelector('#pdf-preview-panel .qd-paper').offsetHeight) });

    // 4c. 키보드: ▾ 에서 ArrowDown 으로 열고 ArrowUp → Enter 로 "한 장"을 골라 저장
    step = 'kbd-enter';
    await caretBtn(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForSelector('[role="menu"]');
    await page.keyboard.press('ArrowUp');
    const kbdDl = await downloadTo(page, () => page.keyboard.press('Enter'), join(OUT, 'kbd-enter.pdf'), 240000);
    await page.waitForTimeout(400);
    log('kbd-enter', { dl: kbdDl, stored: await storedPref(page), menuClosed: (await page.locator('[role="menu"]').count()) === 0, pdfPages: pdfFacts(join(OUT, 'kbd-enter.pdf')).pages });

    // 5. 한 장 26건: 축소 비율 확인
    step = 'fit26';
    const d26 = await chooseMenu(page, 'A4 한 장에 맞춰 저장', 'fit-26.pdf');
    await page.waitForTimeout(600);
    log('fit26', { dl: d26, stored: await storedPref(page), pdf: pdfFacts(join(OUT, 'fit-26.pdf')), preview: await previewMode(page),
      paperH: await page.evaluate(() => document.querySelector('#pdf-preview-panel .qd-paper').offsetHeight) });
    await shotPreview(page, 'preview-fit-26.png');

    // 6. 다시 여러 쪽, 새로고침 후 기억
    step = 'reload';
    await chooseMenu(page, '여러 쪽으로 나눠 저장', 'paged-26b.pdf');
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(2500);
    const skip = page.getByText('건너뛰기');
    if (await skip.count()) await skip.first().click();
    await page.waitForTimeout(500);
    await caretBtn(page).click();
    await page.waitForSelector('[role="menu"]');
    const afterReload = await page.$$eval('[role="menuitemradio"]', els => els.map(e => ({ t: e.innerText.split('\n')[0], checked: e.getAttribute('aria-checked') })));
    await page.keyboard.press('Escape');
    log('reload', { stored: await storedPref(page), menuChecked: afterReload, preview: await previewMode(page) });

    // 7. 50건 일반 견적서 (여러 쪽)
    if (want('p50')) {
      step = 'paged50';
      await fillBasic(page); await fillSales(page);
      await addMany(page, MIX, 0, 50, 90);
      await gotoTab(page, /기본 정보/);
      await page.waitForTimeout(900);
      const dl = await savePdf(page, 'paged-50.pdf');
      log('paged50', { dl, pdf: pdfFacts(join(OUT, 'paged-50.pdf')), pages: await pagesDiag(page, '#pdf-pages-panel') });

      // 7b. 공공 견적서 (같은 50건)
      step = 'public';
      await pickBranding(page, '공공 견적서');
      await page.waitForTimeout(700);
      const dlp = await savePdf(page, 'paged-public.pdf');
      log('public', { dl: dlp, pdf: pdfFacts(join(OUT, 'paged-public.pdf')), pages: await pagesDiag(page, '#pdf-pages-panel') });
      await pickBranding(page, '일반 견적서');
    }

    // 8. 1줄 행(노트 없음) 섞임: 노트를 비운 행과 긴 노트 행을 섞는다
    if (want('mixed')) {
      step = 'mixed';
      await gotoTab(page, /항목/);
      const editors = page.locator('[contenteditable="true"]');
      const n = await editors.count();
      let cleared = 0;
      for (let i = 0; i < n; i += 2) {
        try {
          await editors.nth(i).click();
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Delete');
          cleared++;
        } catch { /* 보이지 않는 편집기는 건너뛴다 */ }
      }
      await gotoTab(page, /기본 정보/);
      await page.waitForTimeout(900);
      const rowHeights = await page.evaluate(() => {
        const hs = [...document.querySelectorAll('#pdf-preview-panel table.qd-items tbody tr:not(.qd-cat)')].map(tr => Math.round(tr.getBoundingClientRect().height));
        return { min: Math.min(...hs), max: Math.max(...hs), distinct: [...new Set(hs)].sort((a, b) => a - b) };
      });
      const dl = await savePdf(page, 'paged-mixed.pdf');
      log('mixed', { editors: n, cleared, rowHeights, dl, pdf: pdfFacts(join(OUT, 'paged-mixed.pdf')), pages: await pagesDiag(page, '#pdf-pages-panel') });
    }

    // 9. 병합 PDF: 26건(2쪽) + 3건(1쪽)
    if (want('merge')) {
      step = 'merge';
      await page.getByRole('button', { name: /초기화/ }).first().click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /^초기화$|계속|확인/ }).last().click().catch(() => {});
      await page.waitForTimeout(500);
      await fillBasic(page, '(주)병합A'); await fillSales(page);
      await addMany(page, QUICK, 0, 26, 110);
      await page.getByRole('button', { name: /멀티 견적/ }).first().click();
      await page.getByPlaceholder(/견적서 이름/).fill('견적A-26건');
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: '닫기' }).click();
      await page.getByRole('button', { name: /초기화/ }).first().click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /^초기화$|계속|확인/ }).last().click().catch(() => {});
      await page.waitForTimeout(500);
      await fillBasic(page, '(주)병합B'); await fillSales(page);
      await addItems(page);
      await page.getByRole('button', { name: /멀티 견적/ }).first().click();
      await page.getByPlaceholder(/견적서 이름/).fill('견적B-3건');
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await page.waitForTimeout(500);
      const hint = await page.locator('text=/합쳐/').allInnerTexts();
      await page.screenshot({ path: join(OUT, 'merge-panel.png') });
      // 저장 목록은 최신순일 수 있으므로 이름 순서대로 선택: A, B
      const toggles = page.locator('li button').filter({ hasText: /^$/ });
      const names = await page.locator('li').allInnerTexts();
      log('merge-list', { names: names.map(t => t.split('\n')[0]), hint });
      const order = ['견적A-26건', '견적B-3건'];
      for (const nm of order) {
        await page.locator('li', { hasText: nm }).locator('button').first().click();
        await page.waitForTimeout(150);
      }
      const dl = await downloadTo(page, () => page.getByRole('button', { name: /병합 PDF/ }).last().click(), join(OUT, 'merged.pdf'), 300000);
      log('merge', { dl, pdf: pdfFacts(join(OUT, 'merged.pdf')) });
    }

    writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
    await ctx.close();
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log('consoleErrors:', JSON.stringify(results.consoleErrors));
}
