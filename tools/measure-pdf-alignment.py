"""PDF 텍스트 레이어 정렬 측정.

앱이 만든 PDF(래스터 이미지 + 투명 텍스트 레이어)를 렌더링해, 텍스트 레이어의 각 줄 상자(bbox)가
래스터 글자 잉크와 얼마나 어긋나는지 잰다. 레이어는 코드가 계산한 좌표이고 잉크는 실제 그려진 픽셀이므로
같은 계산을 되풀이하는 검증이 아니다.

사용: python tools/measure-pdf-alignment.py <pdf> [--dpi 200] [--page N] [--png 렌더결과.png] [--find 문자열 ...]
  --page N : N번째 쪽(1부터, 기본 1)만 잰다. 여러 쪽 PDF 는 쪽마다 따로 돌린다.
필요: pymupdf, numpy
지표(줄마다, mm 로 환산):
  dx_left  = 잉크 왼쪽 끝 - 상자 왼쪽 끝      (시작 위치 어긋남)
  dx_right = 잉크 오른쪽 끝 - 상자 오른쪽 끝   (폭 어긋남: 레이어 글꼴 폭이 화면 글꼴과 다르면 커진다)
  dy       = 잉크 세로 중심 - 상자 세로 중심   (세로 어긋남)
"""
import argparse
import statistics
import sys

import fitz
import numpy as np


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--page", type=int, default=1)
    ap.add_argument("--png")
    ap.add_argument("--find", nargs="*", default=[])
    ap.add_argument("--show", nargs="*", default=[], help="이 문자열을 포함하는 줄의 개별 오프셋을 출력한다(예: 띠 위 흰 글자 줄)")
    args = ap.parse_args()

    doc = fitz.open(args.pdf)
    page = doc[args.page - 1]
    print(f"pages={len(doc)} size_mm={page.rect.width * 25.4 / 72:.1f}x{page.rect.height * 25.4 / 72:.1f}")
    print("fonts:", sorted({f[3] for f in page.get_fonts()}))
    print("images:", [(i[2], i[3]) for i in page.get_images()])

    zoom = args.dpi / 72
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    if args.png:
        pix.save(args.png)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(int)
    mm_per_px = 25.4 / args.dpi

    rows = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                text = span["text"].strip()
                if len(text) < 2:
                    continue
                x0, y0, x1, y1 = [v * zoom for v in span["bbox"]]
                h = y1 - y0
                # 가로 폭 측정창: 줄 상자 세로의 가운데 60% 띠, 가로 -2mm ~ +2.5mm.
                # 띠를 좁게 잡는 이유: 표 머리글·카테고리 행의 밑줄이나 합계 상자 가장자리가 창에 들어오면
                # 글자가 아닌 선을 잉크로 읽어 폭이 부풀려진다.
                wx0, wx1 = int(max(0, x0 - 2 / mm_per_px)), int(min(pix.width, x1 + 2.5 / mm_per_px))
                by0, by1 = int(y0 + 0.2 * h), int(y1 - 0.2 * h)
                band = img[by0:by1, wx0:wx1]
                if band.size == 0:
                    continue
                bg = np.median(band.reshape(-1, 3), axis=0)
                ink = (np.abs(band - bg).max(axis=2) > 70)
                if ink.sum() < 6:
                    continue
                cols = np.where(ink.any(axis=0))[0]
                ink_l, ink_r = wx0 + cols[0], wx0 + cols[-1] + 1
                # 세로 중심: 잉크 열 범위 안에서, 가로로 거의 꽉 찬 줄(밑줄·상자 선)은 제외하고 잉크 무게중심을 쓴다
                vy0, vy1 = int(max(0, y0 - 0.35 * h)), int(min(pix.height, y1 + 0.35 * h))
                vcrop = img[vy0:vy1, ink_l:ink_r]
                vink = (np.abs(vcrop - bg).max(axis=2) > 70)
                full = vink.mean(axis=1) > 0.9
                vink[full, :] = False
                rws = np.where(vink.any(axis=1))[0]
                if len(rws) == 0:
                    continue
                ink_cy = vy0 + (rws[0] + rws[-1] + 1) / 2
                rows.append({
                    "text": text[:24],
                    "font": span["font"],
                    "dx_left": (ink_l - x0) * mm_per_px,
                    "dx_right": (ink_r - x1) * mm_per_px,
                    "dy": (ink_cy - (y0 + y1) / 2) * mm_per_px,
                })

    print(f"measured lines={len(rows)}")
    if rows:
        for key in ("dx_left", "dx_right", "dy"):
            vals = [r[key] for r in rows]
            print(f"{key}: median={statistics.median(vals):+.2f}mm  mean_abs={statistics.mean(abs(v) for v in vals):.2f}mm  max_abs={max(abs(v) for v in vals):.2f}mm")
        bad = [r for r in rows if abs(r["dx_right"]) > 0.8 or abs(r["dx_left"]) > 0.8]
        print(f"lines with |dx|>0.8mm: {len(bad)}/{len(rows)}")
        for r in sorted(bad, key=lambda r: -abs(r["dx_right"]))[:12]:
            print(f"  {r['text']!r:28} {r['font']:<28} dxL={r['dx_left']:+.2f} dxR={r['dx_right']:+.2f} dy={r['dy']:+.2f}")

    for needle in args.show:
        for r in rows:
            if needle in r["text"]:
                print(f"  show {r['text']!r:28} {r['font']:<28} dxL={r['dx_left']:+.2f} dxR={r['dx_right']:+.2f} dy={r['dy']:+.2f}")

    for needle in args.find:
        hits = sum(len(p.search_for(needle)) for p in doc)
        print(f"search {needle!r}: {hits} hit(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
