// 옵션 탭 「직인 표시」 카드 순서(숨김·직인 생략·직인 표시)와 기본 선택(숨김), 선택 동작, 미리보기·PDF 직인 표시를 검증한다.
// 실행: PW_CHROME=<chrome-headless-shell.exe> PYI=<python> node --env-file=<.env> --env-file=<.env.local> tools/verify-seal-options.mjs <출력 폴더>
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, startVite, downloadTo, fillBasic, fillSales } from './lib/quote-driver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] ?? '.work/verify-seal-options');
const PY = process.env.PYI ?? 'python';
mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();
const vite = await startVite(Number(process.env.QB_PORT ?? 3016));
try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await ctx.addInitScript(() => { try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch { /* 없음 */ } });
    const page = await ctx.newPage();
    await page.goto(`${vite.base}/?bypass-auth`);
    await page.waitForTimeout(2000);
    const skip = page.getByText('건너뛰기');
    if (await skip.count()) await skip.first().click();
    await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' });
    await fillBasic(page);
    await fillSales(page);
    await page.getByRole('button', { name: /항목/ }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '+ 추가 문서' }).click();
    await page.getByRole('button', { name: /옵션 설정/ }).first().click();
    await page.waitForTimeout(400);

    const cards = () => page.evaluate(() => {
      const h = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === '직인 표시');
      const wrap = h.closest('div.mt-5').querySelector('div.flex.gap-2');
      return [...wrap.querySelectorAll('button')].map(b => ({ label: b.innerText.trim(), selected: b.className.includes('border-[var(--forcs-blue)]') }));
    });
    const sealInPreview = () => page.evaluate(() => ({
      stamp: document.querySelectorAll('aside .qd-seal, aside .qd-seal-img').length,
      omitText: document.querySelectorAll('aside .qd-ceo-omit').length,
    }));
    const out = {};
    out.initial = { cards: await cards(), preview: await sealInPreview() };
    const section = page.locator('div.mt-5', { hasText: '대표이사명 옆 직인 영역' }).first();
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({ path: join(OUT, 'seal-cards-initial.png') });

    for (const label of ['직인 생략', '직인 표시', '숨김']) {
      await section.locator('button', { hasText: label }).click();
      await page.waitForTimeout(300);
      out['select-' + label] = { cards: (await cards()).filter(c => c.selected).map(c => c.label), preview: await sealInPreview() };
      if (label === '직인 표시') await section.screenshot({ path: join(OUT, 'seal-cards-stamped.png') });
    }
    // 초기화(새 견적서) 후 기본값 복귀: 직인 표시를 고른 뒤 초기화
    await section.locator('button', { hasText: '직인 표시' }).click();
    await page.getByRole('button', { name: /초기화/ }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /^초기화$|계속|확인/ }).last().click().catch(() => {});
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /옵션 설정/ }).first().click();
    await page.waitForTimeout(400);
    out.afterReset = { cards: await cards(), preview: await sealInPreview() };

    // 기본 상태 PDF: 직인 글자 없음
    await page.getByRole('button', { name: /항목/ }).first().click();
    await page.getByRole('button', { name: '+ 추가 문서' }).click();
    await fillBasic(page); await fillSales(page);
    const pdf = join(OUT, 'seal-default.pdf');
    await downloadTo(page, () => page.locator('button[title="PDF / 인쇄"]').click(), pdf, 240000);
    const r = spawnSync(PY, [join(HERE, 'inspect-pdf.py'), pdf, '--find', '직인 생략', '포시에스\n인', '대표이사'], { encoding: 'utf8' });
    out.pdf = r.stdout.split(/\r?\n/).filter(l => /pages=|search|chars/.test(l));
    console.log(JSON.stringify(out, null, 1));
    await ctx.close();
  } finally { await browser.close(); }
} finally { vite.stop(); }
