// 합계 영역(정가 합계~총 결제 금액)의 금액 글자가 화면과 같은 위치에 찍히는지 검증한다.
//
// 배경(2026-11-06 회귀): PR #17 이 복제 문서의 <link> 를 <style> 로 바꾸자 복제본이 글꼴을 다시 내려받았고,
//       html2canvas 가 대체 글꼴 폭으로 글자 위치를 재서 모든 금액의 「원」이 마지막 숫자 위에 겹쳐 찍혔다.
//       verify-pdf-styles 는 수정 후 경로끼리만 비교해 이 회귀를 잡지 못했다. 이 도구는 기준을 "화면 DOM"으로 둔다.
// 방법: CSS 를 운영처럼 <link> 로 서빙한 상태에서 같은 견적의 PDF(한 장)·PNG 를 저장하고, 합계 영역(.qd-sm)을
//       화면 요소 스크린샷(배율 1)과 같은 영역 크롭으로 비교한다(tools/compare-crop.py). 금액 글자가 겹치거나 밀리면 다른 픽셀이 늘어난다.
// 실행: PW_CHROME=<chrome-headless-shell.exe> [QB_BASE_URL=<주소>] node --env-file=<env 파일> tools/verify-sum-area.mjs <출력 폴더>
//   판정: 각 경로의 diff < THRESHOLD. 종료 코드 1 = 실패. PYI 는 비운다. 시스템 python 에 pymupdf·Pillow 필요.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadPlaywright, startVite, openAndFill, downloadTo, ROOT } from './lib/quote-driver.mjs';
import { serveCssAsLink } from './lib/css-link.mjs';

const OUT = resolve(process.argv[2] ?? '.work/verify-sum-area');
mkdirSync(OUT, { recursive: true });
/** 기준(화면 DOM)과 다른 픽셀 비율 상한. 정상 저장본과 「원」 겹침 저장본의 실측값은 export-pipeline.md 함정 14. */
const THRESHOLD = Number(process.env.SUM_AREA_THRESHOLD ?? 0.06);
const { chromium } = loadPlaywright();
const vite = await startVite(Number(process.env.QB_PORT ?? 3023));
let failed = false;
try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    const { page } = await openAndFill(browser, vite.base, { dsf: 1 });
    await page.addStyleTag({ content: '[data-sonner-toaster]{pointer-events:none}' });
    const css = await serveCssAsLink(page);
    console.log('CSS 상태:', css.kind);
    const sel = '#pdf-preview-panel .qd-paper';
    const scenarios = [
      { key: 'pdf-fit', ext: 'pdf', trigger: () => page.locator('button[title="PDF / 인쇄"]').click() },
      { key: 'png', ext: 'png', trigger: () => page.locator('button[title="PNG 이미지로 저장"]').click() },
    ];
    const files = [];
    for (const sc of scenarios) {
      const outPath = join(OUT, `sum-${sc.key}.${sc.ext}`);
      await downloadTo(page, sc.trigger, outPath);
      files.push({ sc, outPath });
    }
    // 저장이 끝난 뒤의 화면 상태를 기준으로 삼는다(저장 전후로 숨김 렌더의 높이가 달라질 수 있다).
    const box = await page.evaluate(s => {
      const paper = document.querySelector(s);
      const sm = paper.querySelector('.qd-sm');
      const p = paper.getBoundingClientRect(), r = sm.getBoundingClientRect();
      return { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height, paperW: p.width };
    }, sel);
    // 숨김 렌더(화면 밖 -9999px)는 요소 스크린샷이 어긋나므로 잠깐 화면 안으로 옮겨 기준 이미지를 찍는다.
    const refPath = join(OUT, 'sum-dom.png');
    await page.evaluate(() => { const c = document.querySelector('#pdf-export-container'); c.dataset.qbLeft = c.style.left; c.style.left = '0px'; c.style.zIndex = '99999'; c.style.background = '#fff'; });
    await page.waitForTimeout(300);
    await page.locator(`${sel} .qd-sm`).first().screenshot({ path: refPath });
    await page.evaluate(() => { const c = document.querySelector('#pdf-export-container'); c.style.left = c.dataset.qbLeft; c.style.zIndex = ''; c.style.background = ''; });
    for (const { sc, outPath } of files) {
      const childEnv = { ...process.env };
      delete childEnv.PYI;
      const cropPath = join(OUT, `sum-${sc.key}-crop.png`);
      const r = spawnSync('python', ['-I', join(ROOT, 'tools', 'compare-crop.py'), refPath, outPath,
        String(box.x), String(box.y), String(box.w), String(box.h), String(box.paperW), '--save', cropPath], { encoding: 'utf8', env: childEnv });
      const line = (r.stdout || r.stderr || '').trim();
      const m = /diff=([\d.]+)/.exec(line);
      const diff = m ? Number(m[1]) : NaN;
      const ok = Number.isFinite(diff) && diff < THRESHOLD;
      if (!ok) failed = true;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${sc.key.padEnd(8)} 합계 영역 diff=${Number.isFinite(diff) ? diff.toFixed(4) : 'NaN'} (상한 ${THRESHOLD}) | ${line}`);
    }
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
}
console.log(failed ? '\n결과: FAIL — 합계 영역 금액 글자가 화면과 다르게 찍힌다 (「원」 겹침 등)' : '\n결과: PASS — 합계 영역이 화면과 같다');
process.exit(failed ? 1 : 0);
