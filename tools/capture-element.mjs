// 정적 HTML 파일에서 CSS 선택자 하나의 요소를 원본 크기로 캡처한다 (푸터 수정 전·후 비교용).
// 사용: node tools/capture-element.mjs <html 파일> <선택자> <출력 png> [뷰포트 폭=1200]
// 브라우저: PW_CHROME (chrome-headless-shell.exe). 요소는 deviceScaleFactor 1 로 찍는다.
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [file, selector, out, width = '1200'] = process.argv.slice(2);
if (!file || !selector || !out) throw new Error('usage: node tools/capture-element.mjs <html> <selector> <out.png> [width]');
const home = process.env.USERPROFILE || process.env.HOME || '';
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_CORE || join(home, '.agent-harness', 'vendor', 'gstack', 'node_modules', 'playwright-core'),
);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
try {
  const page = await browser.newPage({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve(file)).href);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  });
  const el = page.locator(selector).first();
  await el.screenshot({ path: resolve(out) });
  console.log(JSON.stringify(await el.evaluate(n => ({ w: n.offsetWidth, h: n.offsetHeight }))));
} finally {
  await browser.close();
}
