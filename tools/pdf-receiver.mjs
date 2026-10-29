// 브라우저 안에서 만든 PDF Blob 을 파일로 받는 임시 수신 서버 (PDF 정렬 측정용).
// 사용: node tools/pdf-receiver.mjs <출력 폴더> [포트=3999]
//   POST /<파일명> 본문을 <출력 폴더>/<파일명> 으로 저장, GET /<파일명> 은 그 폴더의 파일을 돌려준다(측정용 고정 데이터 전달)
import { createServer } from 'node:http';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const outDir = process.argv[2];
const port = Number(process.argv[3] ?? 3999);
if (!outDir) throw new Error('usage: node tools/pdf-receiver.mjs <outDir> [port]');
mkdirSync(outDir, { recursive: true });

createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (req.method === 'GET') {
    const file = join(outDir, basename(decodeURIComponent(req.url ?? '/')));
    if (!existsSync(file)) { res.writeHead(404, cors); res.end('not found'); return; }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(readFileSync(file));
    return;
  }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const name = basename(decodeURIComponent(req.url ?? '/out.pdf')) || 'out.pdf';
    writeFileSync(join(outDir, name), Buffer.concat(chunks));
    res.writeHead(200, cors); res.end('ok');
  });
}).listen(port, () => console.log(`receiver on ${port} -> ${outDir}`));
