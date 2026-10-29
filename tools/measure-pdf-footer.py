"""PDF 하단(푸터) 텍스트 레이어 정렬 측정 + 오버레이 이미지.

tools/measure-pdf-alignment.py 는 줄 상자 가운데 60% 띠로 재므로, 줄 간격이 좁은 두 줄 글(밴드 슬로건, 강점 두 줄 설명)과
같은 줄에서 span 이 나뉜 글("31"+"년")은 이웃 글자 잉크를 끌어들여 어긋남이 부풀려진다.
이 도구는 span 이 아니라 pymupdf 의 줄(line) 단위로, 줄 상자의 세로 전체와 가로 ±1mm 창만 본다.
같은 창 안의 이웃 줄 잉크는 줄 상자 밖이므로 들어오지 않는다.

사용: python -X utf8 tools/measure-pdf-footer.py <pdf> [--dpi 200] [--from-y 0.80] [--png 오버레이.png]
출력: 푸터 줄마다 dx_left / dx_right / dy (mm), 요약, 오버레이 PNG(줄 상자 = 빨간 사각형).
필요: pymupdf, numpy, Pillow
"""
import argparse
import statistics
import sys

import fitz
import numpy as np
from PIL import Image, ImageDraw


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--from-y", type=float, default=0.80, help="쪽 높이 비율. 이 위치 아래 줄만 잰다")
    ap.add_argument("--png")
    args = ap.parse_args()

    doc = fitz.open(args.pdf)
    page = doc[0]
    zoom = args.dpi / 72
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(int)
    mm = 25.4 / args.dpi
    y_min = args.from_y * pix.height
    pad = int(1.0 / mm)  # 가로 창 ±1mm

    rows = []
    boxes = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(s["text"] for s in line["spans"]).strip()
            if len(text.replace(" ", "")) < 2:
                continue
            x0, y0, x1, y1 = [v * zoom for v in line["bbox"]]
            if y0 < y_min:
                continue
            boxes.append((x0, y0, x1, y1))
            wx0, wx1 = int(max(0, x0 - pad)), int(min(pix.width, x1 + pad))
            by0, by1 = int(y0), int(y1)
            band = img[by0:by1, wx0:wx1]
            if band.size == 0:
                continue
            bg = np.median(band.reshape(-1, 3), axis=0)
            ink = np.abs(band - bg).max(axis=2) > 70
            if ink.sum() < 6:
                continue
            cols = np.where(ink.any(axis=0))[0]
            rws = np.where(ink.any(axis=1))[0]
            ink_l, ink_r = wx0 + cols[0], wx0 + cols[-1] + 1
            ink_cy = by0 + (rws[0] + rws[-1] + 1) / 2
            rows.append({
                "text": text[:22],
                "font": line["spans"][0]["font"],
                "dx_left": (ink_l - x0) * mm,
                "dx_right": (ink_r - x1) * mm,
                "dy": (ink_cy - (y0 + y1) / 2) * mm,
            })

    print(f"pages={len(doc)} footer lines measured={len(rows)} (y >= {args.from_y:.0%} of page)")
    for r in rows:
        print(f"  {r['text']!r:26} {r['font']:<12} dxL={r['dx_left']:+.2f} dxR={r['dx_right']:+.2f} dy={r['dy']:+.2f}")
    if rows:
        for key in ("dx_left", "dx_right", "dy"):
            vals = [r[key] for r in rows]
            print(f"{key}: median={statistics.median(vals):+.2f}mm  mean_abs={statistics.mean(abs(v) for v in vals):.2f}mm  max_abs={max(abs(v) for v in vals):.2f}mm")
        bad = [r for r in rows if abs(r["dx_left"]) > 0.8 or abs(r["dx_right"]) > 0.8 or abs(r["dy"]) > 0.8]
        print(f"lines with |dx|>0.8mm or |dy|>0.8mm: {len(bad)}/{len(rows)}")

    if args.png:
        im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        d = ImageDraw.Draw(im)
        for b in boxes:
            d.rectangle(b, outline=(255, 0, 0), width=1)
        im.crop((0, int(y_min), pix.width, pix.height)).save(args.png)
        print(f"overlay: {args.png}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
