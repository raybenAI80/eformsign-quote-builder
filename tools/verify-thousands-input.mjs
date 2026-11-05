// 천 단위 쉼표 입력 브라우저 시나리오 검증 (단가·할인단가·수량).
// ① 빈 단가 칸에 2000000 을 한 자씩 입력 ② 중간 삽입·Backspace·쉼표 뒤 Backspace(커서 위치)
// ③ 붙여넣기 ④ 새로고침 복원 ⑤ 할인단가 입력 중 쉼표 ⑥ 수량 ⑦ 깨진 저장값("2,00000") 복원 ⑧ 글자 단가 유지.
// 실행: node --env-file=<.env> --env-file=<.env.local> tools/verify-thousands-input.mjs <캡처 폴더>
//   PW_CHROME = chrome-headless-shell.exe 경로(없으면 ms-playwright 에서 찾는다). QB_BASE_URL 이 있으면 vite 를 띄우지 않는다.
// 기대와 다르면 exit 1. 값은 출력하지 않는다(환경변수는 vite 에만 상속).
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPlaywright, startVite } from './lib/quote-driver.mjs';

const OUT = resolve(process.argv[2] ?? '.work/verify-thousands-input');
mkdirSync(OUT, { recursive: true });

if (!process.env.PW_CHROME) {
  const base = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  const dirs = existsSync(base) ? readdirSync(base).filter(d => d.startsWith('chromium_headless_shell')).sort().reverse() : [];
  const found = dirs.map(d => join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')).find(existsSync);
  if (!found) { console.error('PW_CHROME 를 지정하라.'); process.exit(1); }
  process.env.PW_CHROME = found;
}

const DATA_KEY = 'eformsign_quote_simple_contacts_v2_ascii';
const { chromium } = loadPlaywright();
const failures = [];
const log = [];
const check = (id, cond, msg) => { log.push(`${cond ? 'PASS' : 'FAIL'} ${id} ${msg}`); if (!cond) failures.push(`${id}: ${msg}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const vite = await startVite(Number(process.env.QB_PORT ?? 3023));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));

  const open = async () => {
    await page.goto(`${vite.base}/?bypass-auth`);
    await page.waitForTimeout(1800);
    const skip = page.getByText('건너뛰기');
    if (await skip.count()) await skip.first().click();
    await page.waitForTimeout(300);
  };
  const field = label => page.locator(`xpath=//span[normalize-space()="${label}"]/following::input[1]`).first();
  const price = () => field('단가 (정가)');
  const offer = () => field('할인단가');
  const qty = () => field('수량');
  const val = loc => loc.inputValue();
  const caret = loc => loc.evaluate(el => [el.selectionStart, el.selectionEnd]);
  const setCaret = (loc, a, b = a) => loc.evaluate((el, [x, y]) => { el.focus(); el.setSelectionRange(x, y); }, [a, b]);
  const clear = async loc => { await loc.click({ timeout: 4000 }); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); };
  const typeEach = async (loc, text) => {
    const seen = [];
    for (const ch of text) { await page.keyboard.type(ch); seen.push(await val(loc)); }
    return seen;
  };
  const paste = (loc, text) => loc.evaluate((el, t) => { el.focus(); el.select(); document.execCommand('insertText', false, t); }, text);
  const stored = async () => {
    await page.waitForTimeout(700);
    return page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}').items ?? [], DATA_KEY);
  };
  const shot = name => page.screenshot({ path: join(OUT, `${name}.png`) });

  await open();
  await page.getByRole('button', { name: /항목/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '+ 사용자 교육 1H' }).click();
  await page.waitForTimeout(400);

  // ① 한 자씩 입력
  await clear(price());
  const s1 = await typeEach(price(), '2000000');
  check('S1', eq(s1, ['2', '20', '200', '2,000', '20,000', '200,000', '2,000,000']), `단계별 표시값 ${JSON.stringify(s1)}`);
  const it1 = (await stored())[0];
  check('S1', it1?.unitPrice === 2000000, `저장값 ${JSON.stringify(it1?.unitPrice)} (${typeof it1?.unitPrice})`);
  await shot('S1-typed-2000000');

  // ② 커서 위치
  await setCaret(price(), 2); // "2,|000,000"
  await page.keyboard.type('5');
  check('S2a', (await val(price())) === '25,000,000' && eq(await caret(price()), [2, 2]), `중간 삽입 → ${await val(price())} 커서 ${await caret(price())}`);
  await page.keyboard.press('Backspace');
  check('S2b', (await val(price())) === '2,000,000' && eq(await caret(price()), [1, 1]), `삽입 취소 → ${await val(price())} 커서 ${await caret(price())}`);
  await setCaret(price(), 2); // 쉼표 바로 뒤
  await page.keyboard.press('Backspace');
  check('S2c', (await val(price())) === '2,000,000' && eq(await caret(price()), [1, 1]), `쉼표 뒤 Backspace → ${await val(price())} 커서 ${await caret(price())}`);
  await setCaret(price(), 1); // 쉼표 바로 앞
  await page.keyboard.press('Delete');
  check('S2d', (await val(price())) === '2,000,000', `쉼표 앞 Delete → ${await val(price())}`);
  await setCaret(price(), 3); // "2,0|00,000"
  await page.keyboard.press('Delete');
  check('S2e', (await val(price())) === '200,000' && eq(await caret(price()), [2, 2]), `숫자 Delete → ${await val(price())} 커서 ${await caret(price())}`);
  await price().evaluate(el => { el.focus(); el.select(); });
  await page.keyboard.type('7');
  check('S2f', (await val(price())) === '7', `전체 선택 후 입력 → ${await val(price())}`);
  await shot('S2-caret');

  // ③ 붙여넣기
  for (const [text, want] of [['1,234,567', '1,234,567'], ['1234567', '1,234,567'], [' 1 234 567원', '1,234,567']]) {
    await paste(price(), text);
    check('S3', (await val(price())) === want, `붙여넣기 ${JSON.stringify(text)} → ${await val(price())}`);
  }
  check('S3', (await stored())[0]?.unitPrice === 1234567, `붙여넣기 저장값 ${JSON.stringify((await stored())[0]?.unitPrice)}`);
  await shot('S3-paste');

  // ⑤ 할인단가 입력 중 쉼표 (④ 보다 먼저: 정가 1,234,567 상태)
  await clear(price());
  await typeEach(price(), '2000000');
  await clear(offer());
  const s5 = await typeEach(offer(), '1500000');
  check('S5', eq(s5, ['1', '15', '150', '1,500', '15,000', '150,000', '1,500,000']), `할인단가 단계별 ${JSON.stringify(s5)}`);
  await shot('S5-offer');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  check('S5', (await val(offer())) === '1,500,000', `할인단가 blur 뒤 ${await val(offer())}`);

  // ⑥ 수량
  await clear(qty());
  const s6 = await typeEach(qty(), '1500');
  check('S6', eq(s6, ['1', '15', '150', '1,500']), `수량 단계별 ${JSON.stringify(s6)}`);
  await shot('S6-qty');

  // ④ 새로고침 복원
  await page.waitForTimeout(700);
  await open();
  await page.getByRole('button', { name: /항목/ }).first().click();
  await page.waitForTimeout(500);
  check('S4', (await val(price())) === '2,000,000', `새로고침 뒤 단가 ${await val(price())}`);
  check('S4', (await val(qty())) === '1,500', `새로고침 뒤 수량 ${await val(qty())}`);
  check('S4', (await val(offer())) === '1,500,000', `새로고침 뒤 할인단가 ${await val(offer())}`);
  await shot('S4-reload');

  // ⑦ 깨진 저장값 복원
  await page.evaluate(k => {
    const d = JSON.parse(localStorage.getItem(k));
    d.items[0].unitPrice = '2,00000';
    delete d.items[0].offerUnitPrice; d.items[0].discountPct = 0;
    localStorage.setItem(k, JSON.stringify(d));
  }, DATA_KEY);
  await page.goto(`${vite.base}/?bypass-auth`);
  await page.waitForTimeout(1800);
  const skip = page.getByText('건너뛰기');
  if (await skip.count()) await skip.first().click();
  await page.getByRole('button', { name: /항목/ }).first().click();
  await page.waitForTimeout(500);
  check('S7', (await val(price())) === '200,000', `깨진 저장값 "2,00000" 복원 → ${await val(price())}`);
  const it7 = (await stored())[0];
  check('S7', it7?.unitPrice === 200000, `복원 뒤 저장값 ${JSON.stringify(it7?.unitPrice)}`);
  await shot('S7-legacy-restore');

  // ⑧ 글자 단가
  await clear(price());
  await page.keyboard.type('별도 협의');
  check('S8', (await val(price())) === '별도 협의', `글자 단가 표시 ${await val(price())}`);
  check('S8', (await stored())[0]?.unitPrice === '별도 협의', `글자 단가 저장 ${JSON.stringify((await stored())[0]?.unitPrice)}`);
  const previewText = await page.evaluate(() => document.querySelector('#preview-panel')?.innerText ?? '');
  check('S8', previewText.includes('별도 협의'), '미리보기에 글자 단가 표시');
  await shot('S8-text-price');

  check('ERR', pageErrors.length === 0, `페이지 오류 ${pageErrors.length}건 ${pageErrors.slice(0, 2).join(' | ')}`);
} catch (e) {
  const first = String(e.message).split(/\r?\n/)[0];
  failures.push('예외: ' + first);
  log.push('FAIL 예외 ' + first);
} finally {
  await browser.close();
  vite.stop();
}
console.log(log.join('\n'));
console.log(failures.length ? `\nFAIL ${failures.length}건` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
