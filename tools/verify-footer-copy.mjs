// 하단 강점 칸 문구 줄 나눔 검증: 일반 견적서(F2)·공공 견적서(F1) 하단에서 첫 칸 설명이 "업력의 / 대표 SW 기업" 두 줄이고,
// 네 칸의 높이가 같으며 다른 세 칸 문구가 그대로인지 확인한다. 하단 스크린샷과 PDF 한 장도 저장한다.
// 실행: PW_CHROME=<chrome-headless-shell.exe> node --env-file=<env 파일> tools/verify-footer-copy.mjs <출력 폴더>
// 결과: <출력 폴더>/footer-f2.png, footer-f1.png, footer-general.pdf, results.json. 기대와 다르면 exit 1.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPlaywright, startVite, openAndFill, downloadTo } from './lib/quote-driver.mjs';

const OUT = resolve(process.argv[2] ?? '.work/verify-footer-copy');
mkdirSync(OUT, { recursive: true });
const { chromium } = loadPlaywright();
const EXPECT = [['업력의', '대표 SW 기업'], ['자체 기술력의', 'OZ 제품 시리즈'], ['코스닥 상장'], ['수상 및 인증']];
const results = { steps: {}, failures: [] };

const vite = await startVite(Number(process.env.QB_PORT ?? 3017));
try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    const { ctx, page } = await openAndFill(browser, vite.base);
    await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' });

    const facts = kind => page.evaluate(kind => {
      const foot = document.querySelector(`#preview-panel .qd-foot[data-footer="${kind}"]`);
      if (!foot) return null;
      const cols = [...foot.querySelectorAll('.qd-st')].map(st => {
        const span = st.querySelector('span');
        const lines = [];
        // <br> 로 나눈 줄 텍스트
        let cur = '';
        for (const n of span.childNodes) { if (n.nodeName === 'BR') { lines.push(cur); cur = ''; } else cur += n.textContent; }
        lines.push(cur);
        return {
          lines,
          // 실제로 그려진 줄 수: 글자 영역의 윗 좌표 종류 수(화면 미리보기는 축소돼 있어 높이 나눗셈을 쓰지 않는다)
          renderedLines: (() => { const r = document.createRange(); r.selectNodeContents(span); return new Set([...r.getClientRects()].filter(q => q.width > 0).map(q => Math.round(q.top))).size; })(),
          h: Math.round(st.getBoundingClientRect().height),
          bTop: Math.round(st.querySelector('b').getBoundingClientRect().top - foot.getBoundingClientRect().top),
        };
      });
      return { cols, footH: Math.round(foot.getBoundingClientRect().height) };
    }, kind);

    const check = (key, f, kind) => {
      results.steps[key] = f;
      if (!f) { results.failures.push(`${key}: 하단(${kind})을 찾지 못함`); return; }
      EXPECT.forEach((want, i) => {
        if (JSON.stringify(f.cols[i]?.lines) !== JSON.stringify(want)) results.failures.push(`${key}: 칸 ${i + 1} 줄 ${JSON.stringify(f.cols[i]?.lines)} != ${JSON.stringify(want)}`);
      });
      if (f.cols[0].renderedLines !== 2) results.failures.push(`${key}: 첫 칸이 화면에서 ${f.cols[0].renderedLines}줄로 그려짐(2줄이어야 함)`);
      if (new Set(f.cols.map(c => c.h)).size !== 1) results.failures.push(`${key}: 칸 높이가 다름 ${f.cols.map(c => c.h)}`);
      if (new Set(f.cols.map(c => c.bTop)).size !== 1) results.failures.push(`${key}: 큰 수치 세로 위치가 다름 ${f.cols.map(c => c.bTop)}`);
    };

    // F2 일반 견적서(기본)
    check('f2-general', await facts('general'), 'general');
    // #preview-panel 은 PDF 용 숨김 렌더에도 있다. 화면 쪽이 문서 순서상 먼저다.
    await page.locator('#preview-panel .qd-foot[data-footer="general"]').first().screenshot({ path: join(OUT, 'footer-f2.png') });
    const pdf = await downloadTo(page, () => page.locator('button[title="PDF / 인쇄"]').click(), join(OUT, 'footer-general.pdf'), 240000);
    results.steps.pdf = pdf;

    // F1 공공 견적서
    await page.getByRole('button', { name: /옵션 설정/ }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /공공 견적서/ }).first().click();
    await page.waitForTimeout(600);
    check('f1-public', await facts('public'), 'public');
    await page.locator('#preview-panel .qd-foot[data-footer="public"]').first().screenshot({ path: join(OUT, 'footer-f1.png') });
    await ctx.close();
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 1));
}
if (results.failures.length) { console.error('FAIL', results.failures); process.exit(1); }
console.log('OK footer-copy');
