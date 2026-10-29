// 헤더 "PNG" 저장 버튼 브라우저 시나리오 검증: 버튼 표시, 클릭 → .png 다운로드, 파일명·이미지 크기,
// 미리보기를 끈 상태에서의 동작, 좁은 폭 헤더 스크린샷.
//
// 실행: PW_CHROME=<chrome-headless-shell.exe> node --env-file=<env 파일> tools/verify-png-button.mjs <출력 폴더>
// 출력: <폴더>/*.png (스크린샷·다운로드), 콘솔에 관찰값
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPlaywright, startVite, openAndFill, downloadTo } from './lib/quote-driver.mjs';

const OUT = resolve(process.argv[2] ?? '.work/png-button');
mkdirSync(OUT, { recursive: true });
const { chromium } = loadPlaywright();
const vite = await startVite(Number(process.env.QB_PORT ?? 3012));
const pngSize = (p) => { const b = readFileSync(p); return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`; };
const btn = (page) => page.locator('button[title="PNG 이미지로 저장"]');

try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    const { page } = await openAndFill(browser, vite.base, { dsf: 1 });
    await page.addStyleTag({ content: '[data-sonner-toaster]{pointer-events:none}' });

    // 1) 1440 폭: 버튼 표시 + 클릭 → 다운로드
    console.log('버튼 개수(1440):', await btn(page).count(), '| 보임:', await btn(page).isVisible());
    await page.screenshot({ path: join(OUT, 'header-1440.png'), clip: { x: 0, y: 0, width: 1440, height: 60 } });
    const dlPath = join(OUT, 'download-click.png');
    const dl = await downloadTo(page, () => btn(page).click(), dlPath);
    console.log('다운로드 파일명:', dl.name, '| 걸린 시간(ms):', dl.ms, '| 이미지 크기:', pngSize(dlPath));
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, 'after-click-1440.png') });

    // 2) 1024 폭(헤더가 보이는 최소 폭): 넘침 확인
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, 'header-1024.png'), clip: { x: 0, y: 0, width: 1024, height: 60 } });
    const over = await page.evaluate(() => {
      const h = document.querySelector('header');
      const row = h.firstElementChild;
      return { headerW: h.clientWidth, rowScrollW: row.scrollWidth, rowClientW: row.clientWidth };
    });
    console.log('1024 헤더 넘침:', JSON.stringify(over));

    // 3) 375 폭: 헤더는 lg(1024) 미만에서 숨김이다
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    console.log('375 헤더 보임:', await page.locator('header').isVisible(), '| PNG 버튼 보임:', await btn(page).isVisible());
    await page.screenshot({ path: join(OUT, 'mobile-375.png') });

    // 4) 미리보기를 끈 상태(preview-panel 이 display:none)에서 클릭
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(400);
    await page.locator('button[title="미리보기 토글"]').click();
    await page.waitForTimeout(500);
    const offPath = join(OUT, 'download-preview-off.png');
    let offResult;
    try {
      const d = await downloadTo(page, () => btn(page).click(), offPath, 15000);
      offResult = `다운로드됨 ${d.name} ${pngSize(offPath)}`;
    } catch (e) {
      offResult = `다운로드 없음 (${String(e.message).split('\n')[0]})`;
    }
    console.log('미리보기 끈 상태:', offResult);
    await page.screenshot({ path: join(OUT, 'preview-off-1440.png') });
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
}
