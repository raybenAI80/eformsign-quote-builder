// 화면의 CSS 를 <link> 로 서빙되는 상태로 만들고, 필요하면 그 파일 요청을 404 로 만드는 공용 도구.
// verify-pdf-styles.mjs, verify-sum-area.mjs 가 쓴다.

/** 화면의 CSS 를 <link> 로 서빙되는 상태로 만든다(운영 번들과 같은 상태). 반환: { setMode('ok'|'404'), count404() } */
export async function serveCssAsLink(page) {
  const SIM = '/__qb-sim.css';
  let mode = 'ok';
  let n404 = 0;
  let simText = null;
  const hasLink = await page.evaluate(() => document.querySelectorAll('link[rel~="stylesheet"]').length);
  const pattern = hasLink ? '**/assets/*.css' : `**${SIM}`;
  await page.route(pattern, async route => {
    if (mode === '404') {
      n404++;
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
    }
    if (hasLink) return route.continue();
    return route.fulfill({ status: 200, contentType: 'text/css', body: simText });
  });
  if (!hasLink) {
    // dev 서버: <style> 들의 글을 모아 하나의 <link> 파일로 바꾼다
    simText = await page.evaluate(() => Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n'));
    await page.evaluate(href => new Promise(resolve => {
      document.querySelectorAll('style').forEach(s => s.remove());
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = () => resolve(true);
      document.head.appendChild(l);
    }), SIM);
  }
  return { setMode: m => { mode = m; }, count404: () => n404, kind: hasLink ? '운영 번들(link)' : 'dev(style→link 모사)' };
}
