"""PDF 의 모든 쪽을 렌더해 한 장(가로로 나란히)으로 이어 붙인다. 여러 쪽 PDF 를 눈으로 확인할 때 쓴다.

사용: python tools/make-pdf-pages-sheet.py <pdf> <출력.png> [--dpi 100] [--gap 24]
필요: pymupdf, pillow
"""
import argparse
import sys

import fitz
from PIL import Image


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("out")
    ap.add_argument("--dpi", type=int, default=100)
    ap.add_argument("--gap", type=int, default=24)
    args = ap.parse_args()

    doc = fitz.open(args.pdf)
    zoom = args.dpi / 72
    imgs = []
    for page in doc:
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        imgs.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    w = sum(i.width for i in imgs) + args.gap * (len(imgs) + 1)
    h = max(i.height for i in imgs) + args.gap * 2
    sheet = Image.new("RGB", (w, h), (228, 233, 239))
    x = args.gap
    for img in imgs:
        sheet.paste(img, (x, args.gap))
        x += img.width + args.gap
    sheet.save(args.out)
    print(f"pages={len(imgs)} sheet={w}x{h} -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
