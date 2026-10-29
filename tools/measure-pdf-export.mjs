// PDF 저장 1회 실측: 같은 견적(품목 3개, 일반 견적서)으로 PDF 를 만들어 쪽수·용지·크기·생성 시간을 잰다.
// 텍스트 레이어 정렬(dy)은 tools/measure-pdf-alignment.py 로 따로 잰다 (이 스크립트가 마지막에 호출한다).
// 앱 코드는 바꾸지 않는다. --baseline 이면 playwright 라우트로 exportPdf 모듈의 화질 상수만 2 / 0.95 로 바꿔 내려준다.
//
// 실행: PW_CHROME=<chrome-headless-shell.exe> [PYI=<python 실행 파일>] node --env-file=<env 파일> tools/measure-pdf-export.mjs <출력 폴더> [--baseline]
// 생성 시간 = PDF 버튼 클릭부터 다운로드 이벤트까지(ms). 첫 실행(폰트 로드)은 버리고 3회 돌려 중앙값을 쓴다.
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, startVite, openAndFill } from './lib/quote-driver.mjs';

const args = process.argv.slice(2);
const baseline = args.includes('--baseline');
const OUT = resolve(args.find(a => !a.startsWith('--')) ?? '.work/pdfq');
mkdirSync(OUT, { recursive: true });
const HERE = dirname(fileURLToPath(import.meta.url));
const ROUNDS = 3;

const { chromium } = loadPlaywright();
const vite = await startVite(Number(process.env.QB_PORT ?? 3012));
const files = [];
try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    const { ctx, page } = await openAndFill(browser, vite.base);
    if (baseline) {
      let patched = 0;
      await ctx.route(/\/src\/utils\/exportPdf\.ts(\?.*)?$/, async route => {
        const res = await route.fetch();
        let body = await res.text();
        body = body.replace(/const PDF_CAPTURE_SCALE = 3;/, () => { patched++; return 'const PDF_CAPTURE_SCALE = 2;'; });
        body = body.replace(/const PDF_JPEG_QUALITY = 0\.9;/, () => { patched++; return 'const PDF_JPEG_QUALITY = 0.95;'; });
        const headers = { ...res.headers() };
        delete headers['content-length']; delete headers.etag; delete headers['cache-control'];
        await route.fulfill({ status: 200, headers: { ...headers, 'cache-control': 'no-store' }, body });
      });
      await page.reload();
      await page.waitForTimeout(2500);
      const skip = page.getByText('건너뛰기');
      if (await skip.count()) await skip.first().click();
      const { fillBasic, fillSales, addItems } = await import('./lib/quote-driver.mjs');
      await fillBasic(page); await fillSales(page); await addItems(page);
      await page.getByRole('button', { name: /기본 정보/ }).first().click();
      await page.waitForTimeout(600);
      console.log('baseline 치환 위치:', patched);
      if (patched !== 2) throw new Error('baseline 치환 실패');
    }

    const tag = baseline ? 'baseline-s2-q95' : 'current';
    const runOnce = async name => {
      const t0 = Date.now();
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 180000 }),
        page.locator('button[title="PDF / 인쇄"]').click(),
      ]);
      const ms = Date.now() - t0;
      const path = join(OUT, `${name}.pdf`);
      await dl.saveAs(path);
      return { ms, bytes: statSync(path).size, path };
    };

    await runOnce(`${tag}-warmup`);
    const times = [];
    for (let r = 0; r < ROUNDS; r++) {
      const res = await runOnce(`${tag}-${r + 1}`);
      times.push(res.ms);
      files.push(res.path);
      console.log(`round ${r + 1}: ${res.ms}ms ${(res.bytes / 1048576).toFixed(3)}MB`);
      await page.waitForTimeout(500);
    }
    const median = [...times].sort((a, b) => a - b)[times.length >> 1];
    console.log(`${tag}: 생성 시간 중앙값 ${median}ms (전체 ${times.join(', ')})`);
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
}

const py = process.env.PYI ?? 'python';
const r = spawnSync(py, [join(HERE, 'measure-pdf-alignment.py'), files[files.length - 1], '--dpi', '200'], { stdio: 'inherit', shell: true });
if (r.status !== 0) {
  console.error(`정렬 측정 실패(status ${r.status}). 수동 실행: ${py} tools/measure-pdf-alignment.py "${files[files.length - 1]}"`);
  process.exitCode = 1;
}
