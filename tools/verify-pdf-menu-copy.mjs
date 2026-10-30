// PDF 저장 메뉴(▾) 문구 검증: 한 장에 들어가는 견적(품목 1건)과 넘치는 견적(26건)에서 안내 줄·항목 부제가 기대와 같은지,
// 메뉴 폭 안에서 문구가 가로로 넘치지 않는지 확인하고 스크린샷을 남긴다. 기대와 다르면 exit 1.
// 실행: PW_CHROME=<chrome-headless-shell.exe> node --env-file=<env 파일> tools/verify-pdf-menu-copy.mjs <출력 폴더>
// 결과: <출력 폴더>/menu-1item.png, menu-26items.png, results.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPlaywright, startVite, fillBasic, fillSales } from './lib/quote-driver.mjs';

const OUT = resolve(process.argv[2] ?? '.work/verify-pdf-menu-copy');
mkdirSync(OUT, { recursive: true });
const { chromium } = loadPlaywright();
const results = { steps: {}, failures: [] };
const NAMES = ['+ 구독형 Business', '+ 문서 세팅 3건', '+ 추가 문서', '+ 충전형 문서', '+ 계정 구성 지원', '+ 유료 옵션 활용 가능 (10만)', '+ 타임스탬프', '+ 사용자 교육 1H'];
const NOTICE = '지금은 한 장에 들어가서 두 방식의 결과가 같습니다.';
const caretBtn = page => page.locator('button[aria-label="PDF 저장 방식 선택"]');

async function open(browser, base, itemCount) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${base}/?bypass-auth`);
  await page.waitForTimeout(2000);
  const skip = page.getByText('건너뛰기');
  if (await skip.count()) await skip.first().click();
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' });
  await fillBasic(page);
  await fillSales(page);
  await page.getByRole('button', { name: /항목/ }).first().click();
  await page.waitForTimeout(400);
  for (let i = 0; i < itemCount; i++) {
    await page.getByRole('button', { name: NAMES[i % NAMES.length] }).first().click();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(600);
  return { ctx, page };
}

async function menuFacts(page) {
  await caretBtn(page).click();
  await page.waitForSelector('[role="menu"]');
  const f = await page.evaluate(() => {
    const menu = document.querySelector('[role="menu"]');
    const ps = [...menu.querySelectorAll('p')].map(p => p.innerText.trim());
    const items = [...menu.querySelectorAll('[role="menuitemradio"]')].map(b => {
      const [title, sub] = [...b.querySelectorAll('span.block')].map(s => s.innerText.trim());
      return { title, sub };
    });
    const mr = menu.getBoundingClientRect();
    const overflow = [...menu.querySelectorAll('p, span.block')].filter(e => e.scrollWidth > e.clientWidth + 1).length;
    return { ps, items, menuW: Math.round(mr.width), menuH: Math.round(mr.height), overflow, rect: { x: mr.x, y: mr.y, w: mr.width, h: mr.height } };
  });
  return f;
}

const expect = (key, cond, msg) => { if (!cond) results.failures.push(`${key}: ${msg}`); };

const vite = await startVite(Number(process.env.QB_PORT ?? 3018));
try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    // 한 장에 들어가는 견적: 품목 1건
    {
      const { ctx, page } = await open(browser, vite.base, 1);
      const f = await menuFacts(page);
      results.steps['1item'] = f;
      const { rect } = f;
      await page.screenshot({ path: join(OUT, 'menu-1item.png'), clip: { x: Math.max(0, rect.x - 16), y: Math.max(0, rect.y - 60), width: rect.w + 32, height: rect.h + 76 } });
      expect('1item', f.ps[0].includes('항목 1건'), `제목 줄 ${f.ps[0]}`);
      expect('1item', f.ps[1] === NOTICE, `안내 줄 ${f.ps[1]}`);
      expect('1item', f.items[0]?.sub === '내용이 길면 한 장에 맞게 글자를 줄입니다', `한 장 부제 ${f.items[0]?.sub}`);
      expect('1item', f.items[1]?.sub === '내용이 길면 글자 크기를 유지하고 쪽을 나눕니다', `여러 쪽 부제 ${f.items[1]?.sub}`);
      expect('1item', f.ps.at(-1) === '마지막으로 고른 방식이 PDF 버튼의 기본 동작이 됩니다.', `하단 안내 ${f.ps.at(-1)}`);
      expect('1item', f.overflow === 0, `가로로 넘치는 문구 ${f.overflow}개`);
      await ctx.close();
    }
    // 한 장을 넘는 견적: 26건
    {
      const { ctx, page } = await open(browser, vite.base, 26);
      const f = await menuFacts(page);
      results.steps['26items'] = f;
      const { rect } = f;
      await page.screenshot({ path: join(OUT, 'menu-26items.png'), clip: { x: Math.max(0, rect.x - 16), y: Math.max(0, rect.y - 60), width: rect.w + 32, height: rect.h + 76 } });
      expect('26items', f.ps.every(p => p !== NOTICE), '안내 줄이 보이면 안 됨');
      expect('26items', /^1쪽 · 글자 약 \d+%로 줄어듭니다$/.test(f.items[0]?.sub ?? ''), `한 장 부제 ${f.items[0]?.sub}`);
      expect('26items', /^\d+쪽 · 글자 크기 그대로$/.test(f.items[1]?.sub ?? ''), `여러 쪽 부제 ${f.items[1]?.sub}`);
      expect('26items', f.overflow === 0, `가로로 넘치는 문구 ${f.overflow}개`);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 1));
}
if (results.failures.length) { console.error('FAIL', results.failures); process.exit(1); }
console.log('OK pdf-menu-copy');
