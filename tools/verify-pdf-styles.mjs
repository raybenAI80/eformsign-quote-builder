// PDF·PNG 저장 때 CSS 파일 요청이 실패해도 서식이 유지되는지 검증한다.
//
// 배경: html2canvas 는 문서를 숨은 iframe 에 복제하고, 운영 번들의 CSS(<link rel="stylesheet">)를 다시 받는다.
//       앱을 연 채 새 배포가 나가 옛 해시 CSS 가 404 가 되면 PDF·PNG 가 서식 없는 HTML 처럼 찍혔다(2026-11-05).
//       vite dev 서버는 CSS 가 <style> 이라 이 경로를 못 탄다. 그래서 이 도구가 dev·운영 어느 쪽이든 CSS 를
//       <link> 로 서빙되는 상태로 만든 뒤, 정상 저장본(기준)과 CSS 404 상태의 저장본을 픽셀로 비교한다.
//
// 실행: PW_CHROME=<chrome-headless-shell.exe> [QB_BASE_URL=<주소>] node --env-file=<env 파일> tools/verify-pdf-styles.mjs <출력 폴더>
//   PYI 는 비운다. 시스템 python 에 pymupdf 필요. 판정: 모든 경로에서 기준과 다른 픽셀 비율 < 0.02, CSS 404 가 실제로 발생.
//   종료 코드 1 = 서식이 빠졌거나 전제(CSS 404 요청)가 만들어지지 않음.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadPlaywright, startVite, openAndFill, downloadTo, ROOT } from './lib/quote-driver.mjs';
import { serveCssAsLink } from './lib/css-link.mjs';

const OUT = resolve(process.argv[2] ?? '.work/verify-pdf-styles');
mkdirSync(OUT, { recursive: true });
const THRESHOLD = 0.02;
const { chromium } = loadPlaywright();
const vite = await startVite(Number(process.env.QB_PORT ?? 3022));

function diffAgainst(base, other, savePng) {
  const env = { ...process.env };
  delete env.PYI;
  const r = spawnSync('python', ['-I', join(ROOT, 'tools', 'compare-raster.py'), base, other, '--save', savePng], { encoding: 'utf8', env });
  const out = (r.stdout || r.stderr || '').trim();
  const m = /diff=([\d.]+)/.exec(out);
  return { out, diff: m ? Number(m[1]) : NaN };
}

const results = [];
let failed = false;
try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    const { page } = await openAndFill(browser, vite.base, {});
    await page.addStyleTag({ content: '[data-sonner-toaster]{pointer-events:none}' });
    const css = await serveCssAsLink(page);
    console.log('CSS 상태:', css.kind);
    // 화면이 서식대로 보이는지 먼저 확인(링크 전환이 깨졌다면 기준이 무의미하다)
    const styled = await page.evaluate(() => getComputedStyle(document.querySelector('#pdf-preview-panel .qd-paper')).width);
    console.log('기준 용지 폭:', styled);

    const pdfBtn = () => page.locator('button[title="PDF / 인쇄"]').click();
    const pngBtn = () => page.locator('button[title="PNG 이미지로 저장"]').click();
    const pagedItem = async () => {
      await page.locator('button[title="PDF 저장 방식 선택"]').click();
      await page.waitForTimeout(300);
      await page.getByRole('menuitemradio').nth(1).click();
    };
    const scenarios = [
      { key: 'pdf-fit', ext: 'pdf', trigger: pdfBtn },
      { key: 'png', ext: 'png', trigger: pngBtn },
      { key: 'pdf-paged', ext: 'pdf', trigger: pagedItem },
    ];
    for (const sc of scenarios) {
      css.setMode('ok');
      const basePath = join(OUT, `${sc.key}-base.${sc.ext}`);
      await downloadTo(page, sc.trigger, basePath);
      css.setMode('404');
      const before = css.count404();
      const brokenPath = join(OUT, `${sc.key}-css404.${sc.ext}`);
      await downloadTo(page, sc.trigger, brokenPath);
      css.setMode('ok');
      const got404 = css.count404() - before;
      const { out, diff } = diffAgainst(basePath, brokenPath, join(OUT, `${sc.key}-css404-p1.png`));
      const ok = got404 >= 1 && diff < THRESHOLD;
      if (!ok) failed = true;
      results.push({ key: sc.key, css404Requests: got404, diff, ok });
      console.log(`${ok ? 'PASS' : 'FAIL'} ${sc.key.padEnd(10)} CSS 404 요청 ${got404}건 | ${out}`);
    }
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
}
console.log(failed ? '\n결과: FAIL — CSS 요청이 실패하면 출력물에서 서식이 빠진다 (또는 전제 미충족)' : '\n결과: PASS — CSS 요청이 실패해도 출력물 서식 유지');
process.exit(failed ? 1 : 0);
