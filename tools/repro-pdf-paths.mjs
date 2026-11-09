// PDF 를 만드는 경로별 재현 도구: 각 경로로 PDF 를 받아 저장하고, 서식이 적용됐는지 판정한다.
// 서식 판정: PDF 쪽 래스터(첫 쪽)를 pymupdf 로 렌더한 뒤 ① 큰 이미지 한 장이 쪽 전체를 덮는지
//            ② 흰 바탕 대비 비백색 픽셀 비율·쪽 안 가장 큰 가로 막대(표 테두리) 유무를 본다.
// 실행: PW_CHROME=<chrome-headless-shell.exe> [QB_BASE_URL=<주소>] node --env-file=<env> tools/repro-pdf-paths.mjs <출력 폴더> [경로,...]
//   경로: main(PDF 버튼) | paged(메뉴 여러 쪽) | print(@media print, Playwright page.pdf)
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPlaywright, startVite, openAndFill, downloadTo, ROOT, launchBrowser, runPython } from './lib/quote-driver.mjs';

const OUT = resolve(process.argv[2] ?? '.work/repro-pdf');
const only = (process.argv[3] ?? 'main,paged,print').split(',');
mkdirSync(OUT, { recursive: true });
const { chromium } = loadPlaywright();
const CSS_DELAY = Number(process.env.QB_CSS_DELAY_MS ?? 0); // 앱이 뜬 뒤 CSS 파일 응답을 이만큼 늦춘다(느린 네트워크 모사)
const vite = await startVite(Number(process.env.QB_PORT ?? 3020));

function analyze(pdf, png) {
  const r = runPython(['-I', join(ROOT, 'tools', 'inspect-pdf-style.py'), pdf, png]);
  return (r.stdout || r.stderr || '').trim();
}

try {
  const browser = await launchBrowser(chromium);
  try {
    const { page } = await openAndFill(browser, vite.base, {});
    page.on('console', m => { if (/error|fail/i.test(m.type() + m.text())) console.log('  [console]', m.type(), m.text().slice(0, 200)); });
    page.on('requestfailed', r => console.log('  [requestfailed]', r.url().slice(0, 150)));
    await page.addStyleTag({ content: '[data-sonner-toaster]{pointer-events:none}' });
    if (CSS_DELAY > 0) {
      await page.route('**/assets/*.css', async route => {
        await new Promise(r => setTimeout(r, CSS_DELAY));
        await route.continue();
      });
      console.log('CSS 응답 지연', CSS_DELAY + 'ms');
    }
    if (process.env.QB_CSS_MODE === '404') {
      // 앱을 연 채 새 배포가 나간 상황: 옛 해시의 CSS 파일이 사라져 404 가 된다(이미 로드된 화면은 그대로다)
      await page.route('**/assets/*.css', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' }));
      console.log('CSS 파일 404 로 응답');
    }
    for (const p of only) {
      const pdf = join(OUT, `${p}.pdf`);
      const png = join(OUT, `${p}-p1.png`);
      try {
        if (p === 'main') {
          const dl = await downloadTo(page, () => page.locator('button[title="PDF / 인쇄"]').click(), pdf);
          console.log(p, '다운로드', dl.name, dl.ms + 'ms');
        } else if (p === 'paged') {
          await page.locator('button[title="PDF 저장 방식 선택"]').click();
          await page.waitForTimeout(300);
          const dl = await downloadTo(page, () => page.getByRole('menuitemradio').nth(1).click(), pdf);
          console.log(p, '다운로드', dl.name, dl.ms + 'ms');
        } else if (p === 'merge') {
          await page.locator('button[title^="멀티 견적"]').click();
          await page.waitForTimeout(400);
          for (const name of ['견적 A', '견적 B']) {
            await page.getByPlaceholder(/견적서 이름/).fill(name);
            await page.getByRole('button', { name: '저장', exact: true }).click();
            await page.waitForTimeout(300);
          }
          // 목록 안의 선택 버튼(번호 칸) 두 개
          const boxes = page.locator('button.rounded.border-2');
          await boxes.nth(0).click();
          await boxes.nth(1).click();
          const dl = await downloadTo(page, () => page.getByRole('button', { name: /병합 PDF/ }).click(), pdf);
          console.log(p, '다운로드', dl.name, dl.ms + 'ms');
        } else if (p === 'print') {
          await page.emulateMedia({ media: 'print' });
          await page.pdf({ path: pdf, format: 'A4', landscape: true, printBackground: true });
          await page.emulateMedia({ media: 'screen' });
          console.log(p, 'page.pdf 저장');
        }
        console.log(p, '=>', analyze(pdf, png));
      } catch (e) {
        console.log(p, '실패:', String(e.message).split('\n')[0]);
      }
    }
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
}
