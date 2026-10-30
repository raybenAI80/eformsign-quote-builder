"""견적서 PDF 기본 사실 검사: 쪽수, 쪽 크기(mm), 텍스트 추출, 검색어 적중, 페이지 렌더.

사용: python tools/inspect-pdf.py <pdf> [--dpi 150] [--png 1쪽결과.png] [--png-all 폴더] [--find 문자열 ...]
필요: pymupdf
"""
import argparse
import sys

import fitz


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--dpi", type=int, default=150)
    ap.add_argument("--png")
    ap.add_argument("--png-all", help="모든 쪽을 <폴더>/page-N.png 로 렌더한다")
    ap.add_argument("--find", nargs="*", default=[])
    args = ap.parse_args()

    doc = fitz.open(args.pdf)
    print(f"pages={len(doc)}")
    for i, page in enumerate(doc, 1):
        w = page.rect.width * 25.4 / 72
        h = page.rect.height * 25.4 / 72
        text = page.get_text()
        print(f"page {i}: {w:.1f}x{h:.1f}mm chars={len(text)} images={len(page.get_images())}")
        for needle in args.find:
            print(f"  search {needle!r}: {len(page.search_for(needle))} hit(s)")
    if args.png:
        zoom = args.dpi / 72
        pix = doc[0].get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        pix.save(args.png)
        print(f"png: {args.png} {pix.width}x{pix.height}")
    if args.png_all:
        import os
        os.makedirs(args.png_all, exist_ok=True)
        zoom = args.dpi / 72
        for i, page in enumerate(doc, 1):
            out = os.path.join(args.png_all, f"page-{i}.png")
            page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False).save(out)
            print(f"png: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
