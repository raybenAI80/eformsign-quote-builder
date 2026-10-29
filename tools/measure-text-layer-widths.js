// 브라우저 콘솔(dev 서버 앱)에서 실행: PDF 텍스트 레이어(jsPDF 글꼴 폭)가
// 화면 DOM 글자 폭과 얼마나 다른지 잰다. 한 줄로 렌더된 텍스트 노드만 대상.
// 결과: ratio(레이어/DOM) 중앙값·최소·최대, 0.5mm 넘게 어긋난 줄 목록.
(async () => {
  const { default: jsPDF } = await import('/node_modules/.vite/deps/jspdf.js');
  const fl = await import('/src/utils/fontLoader.ts');
  await fl.loadPdfFonts();
  await fl.loadScreenFonts();
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  fl.registerPdfFonts(pdf);
  const el = document.getElementById('pdf-preview-panel');
  const pxToMm = 206 / el.offsetWidth; // computePageImageLayout: 폭 기준 맞춤(206mm)
  const out = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent;
    if (!t.trim()) continue;
    const cs = getComputedStyle(n.parentElement);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    if (r.getClientRects().length !== 1) continue;
    const text = t.replace(/\s*[\r\n]+\s*/g, ' ').trim();
    if (text.length < 2) continue;
    const f = fl.resolvePdfFont(pdf, cs.fontFamily, parseInt(cs.fontWeight) || 400);
    pdf.setFont(f.family, f.style);
    pdf.setFontSize((parseFloat(cs.fontSize) * pxToMm) / 0.3527777778);
    const layer = pdf.getTextWidth(text);
    const lead = t.length - t.trimStart().length;
    const rr = document.createRange();
    rr.setStart(n, lead);
    rr.setEnd(n, lead + t.trim().length);
    const dom = rr.getBoundingClientRect().width * pxToMm;
    out.push({ text: text.slice(0, 22), font: `${f.family}/${f.style}`, ratio: layer / dom, diffmm: layer - dom });
  }
  const ratios = out.map(o => o.ratio).sort((a, b) => a - b);
  return {
    n: out.length,
    median: ratios[Math.floor(ratios.length / 2)],
    min: ratios[0],
    max: ratios[ratios.length - 1],
    over05mm: out.filter(o => Math.abs(o.diffmm) > 0.5).length,
    worst: out.filter(o => Math.abs(o.diffmm) > 0.5).sort((a, b) => Math.abs(b.diffmm) - Math.abs(a.diffmm)).slice(0, 10),
  };
})();
