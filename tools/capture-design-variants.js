// 브라우저 콘솔(dev 서버 3017 등)에서 실행: 견적 변형(지원사업·단수 절사·공공용·직인 / 할인 숨김 / 품목 26건)을
// iframe 안 앱에 복원시킨 뒤 PDF 로 내보내 tools/pdf-receiver.mjs 로 보낸다. 결과 파일: d-subsidy.pdf, d-nodisc.pdf, d-long.pdf
// 먼저 tools/pdf-capture-driver.js 의 로직(__capturePdf)을 iframe 에 심는다. 고정 데이터 = GET /fixture.json
(async () => {
  const KEY = 'eformsign_quote_simple_contacts_v2_ascii';
  const fx = await (await fetch('http://localhost:3999/fixture.json')).json();
  const driver = `(() => { const blobs = []; const oc = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (o) => { if (o instanceof Blob) blobs.push(o); return oc(o); };
    try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch (e) {}
    window.__capturePdf = async (name) => { const before = blobs.length; const mod = await import('/src/utils/exportPdf.ts');
      await mod.exportToPdf('pdf-preview-panel', name);
      for (let i = 0; i < 100 && blobs.length === before; i++) await new Promise(r => setTimeout(r, 100));
      const b = blobs[blobs.length - 1]; const r = await fetch('http://localhost:3999/' + name + '.pdf', { method: 'POST', body: b });
      return { status: r.status, bytes: b.size }; }; })()`;
  const many = Array.from({ length: 26 }, (_, i) => ({ ...fx.items[i % fx.items.length], id: 'm' + i, item: `${fx.items[i % fx.items.length].item} ${i + 1}` }));
  const variants = {
    'd-subsidy': { meta: { sector: 'subsidy', subsidyRate: 70, roundingUnit: 100000, brandingMode: 'public', sealMode: 'stamped' }, items: fx.items },
    'd-nodisc': { meta: { showDiscount: false, brandingMode: 'default', sealMode: 'hidden' }, items: fx.items.map(i => ({ ...i, item: i.item.replace('Enterprise', 'Standard') })) },
    'd-long': { meta: {}, items: many },
  };
  const out = {};
  for (const [name, v] of Object.entries(variants)) {
    localStorage.setItem(KEY, JSON.stringify({ meta: { ...fx.meta, ...v.meta }, items: v.items }));
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:0;top:0;width:1440px;height:1000px;opacity:0;pointer-events:none';
    f.src = '/?bypass-auth';
    document.body.appendChild(f);
    await new Promise(r => { f.onload = r; });
    await new Promise(r => setTimeout(r, 1500));
    const panel = f.contentDocument.getElementById('pdf-preview-panel');
    const dims = { w: panel.offsetWidth, h: panel.offsetHeight };
    f.contentWindow.eval(driver);
    out[name] = { dims, pdf: await f.contentWindow.__capturePdf(name) };
    f.remove();
  }
  return out;
})();
