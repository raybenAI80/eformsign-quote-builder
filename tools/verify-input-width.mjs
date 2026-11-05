// 품목 편집 행의 금액 입력칸이 큰 숫자에서 잘리지 않는지 검사한다 (input.scrollWidth <= clientWidth).
// ① 할인 칸이 없는 행(구독형 Business, 표시 설정에서 할인율 컬럼 끔) ② 할인 칸이 있는 일반 행, 폭 1440 / 1100.
// 실행: node --env-file=<.env> --env-file=<.env.local> tools/verify-input-width.mjs <캡처 폴더>
// 값은 출력하지 않는다. 기대와 다르면 exit 1. PW_CHROME / QB_BASE_URL 은 verify-thousands-input.mjs 와 같다.
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPlaywright, startVite } from './lib/quote-driver.mjs';

const OUT = resolve(process.argv[2] ?? '.work/verify-input-width');
mkdirSync(OUT, { recursive: true });
if (!process.env.PW_CHROME) {
  const base = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  const dirs = existsSync(base) ? readdirSync(base).filter(d => d.startsWith('chromium_headless_shell')).sort().reverse() : [];
  const found = dirs.map(d => join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')).find(existsSync);
  if (!found) { console.error('PW_CHROME 를 지정하라.'); process.exit(1); }
  process.env.PW_CHROME = found;
}
const TAG = process.env.WIDTH_TAG ?? 'after';
const { chromium } = loadPlaywright();
const failures = [];
const rows = [];
const vite = await startVite(Number(process.env.QB_PORT ?? 3024));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME, headless: true });
try {
  for (const width of [1440, 1100]) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await ctx.newPage();
    const open = async () => {
      await page.goto(`${vite.base}/?bypass-auth`);
      await page.waitForTimeout(1800);
      const skip = page.getByText('건너뛰기');
      if (await skip.count()) await skip.first().click();
      await page.waitForTimeout(300);
    };
    const field = (row, label) => row.locator(`xpath=.//span[normalize-space()="${label}"]/following::input[1]`).first();
    const fill = async (loc, text) => { await loc.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await page.keyboard.type(text); };
    const measure = (loc) => loc.evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, shown: el.value }));
    const record = async (kind, row, label, text) => {
      const loc = field(row, label);
      await fill(loc, text);
      await page.keyboard.press('Tab'); // 포커스 없는 상태에서 측정
      const m = await measure(loc);
      const ok = m.sw <= m.cw;
      rows.push({ width, kind, label, typed: text, cw: m.cw, sw: m.sw, ok });
      if (!ok) failures.push(`${width} ${kind} ${label} ${text}: scrollWidth ${m.sw} > clientWidth ${m.cw}`);
    };

    await open();
    await page.getByRole('button', { name: /항목/ }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: '+ 구독형 Business' }).click();
    await page.getByRole('button', { name: '+ 사용자 교육 1H' }).click();
    await page.waitForTimeout(400);
    const rowOf = name => page.locator('div.group.relative.flex').filter({ has: page.locator(`input[placeholder="항목명을 입력"]`) }).filter({ hasText: '' }).filter({ has: page.locator(`xpath=.//input[starts-with(@placeholder,"항목명")]`) }).nth(name === '구독형 Business' ? 0 : 1);

    // 할인 칸이 있는 일반 행
    const normal = rowOf('사용자 교육 1H');
    await record('discount-on', normal, '수량', '9999999');
    await record('discount-on', normal, '단가 (정가)', '1234567890000');
    await record('discount-on', normal, '할인단가', '1234567890000');
    await record('discount-on', normal, '단가 (정가)', '999999999999999'); // 입력 상한 15자리
    await page.screenshot({ path: join(OUT, `${TAG}-${width}-discount-on.png`) });

    // 표시 설정에서 할인율 컬럼 끄기 → 할인 칸 없는 행
    await page.getByRole('button', { name: /옵션/ }).first().click();
    await page.waitForTimeout(400);
    await page.getByText('할인율 컬럼 표시').first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /항목/ }).first().click();
    await page.waitForTimeout(400);
    const sub = rowOf('구독형 Business');
    await record('discount-off', sub, '수량', '9999999');
    await record('discount-off', sub, '단가 (정가)', '4000000000');
    await record('discount-off', sub, '단가 (정가)', '1234567890000');
    await page.screenshot({ path: join(OUT, `${TAG}-${width}-discount-off.png`) });
    await ctx.close();
  }
} finally {
  await browser.close();
  vite.stop();
}
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.width} ${r.kind} ${r.label} 입력=${r.typed} clientWidth=${r.cw} scrollWidth=${r.sw}`);
if (failures.length) { console.error(`FAIL ${failures.length}건`); process.exit(1); }
console.log('ALL PASS');
