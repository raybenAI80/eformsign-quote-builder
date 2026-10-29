// 브라우저 콘솔(또는 javascript_tool)에서 실행: dev 서버 앱(/?bypass-auth)의 PDF 내보내기를 돌려 결과 Blob 을
// tools/pdf-receiver.mjs 로 보낸다. 사용: await window.__capturePdf('d-normal', false)  /  ('d-debug', true)
// debug=true 이면 텍스트 레이어가 빨간 글씨로 보인다 (exportPdf.ts 의 window.__PDF_DEBUG_OCR__).
(() => {
  const blobs = [];
  const origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (obj) => { if (obj instanceof Blob) blobs.push(obj); return origCreate(obj); };
  try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch (e) { /* 이미 없음 */ }
  window.__capturePdf = async (name, debug, port = 3999) => {
    window.__PDF_DEBUG_OCR__ = !!debug;
    const before = blobs.length;
    const mod = await import('/src/utils/exportPdf.ts');
    await mod.exportToPdf('pdf-preview-panel', name);
    for (let i = 0; i < 100 && blobs.length === before; i++) await new Promise(r => setTimeout(r, 100));
    const blob = blobs[blobs.length - 1];
    if (!blob || blobs.length === before) throw new Error('PDF blob 을 받지 못했다');
    const r = await fetch(`http://localhost:${port}/${name}.pdf`, { method: 'POST', body: blob });
    return { status: r.status, bytes: blob.size };
  };
})();
