"""일반·공공 PDF 의 1쪽 하단을 PDF 안 래스터 원본 해상도로 잘라 한 장(foot-compare.png)으로 합친다.

사용: python -X utf8 tools/make-footer-compare.py <일반.pdf> <공공.pdf> <출력 폴더>
출력: <폴더>/foot-general-native.png, foot-public-native.png (각 PDF 래스터의 아래쪽 푸터 영역 원본 픽셀),
      <폴더>/foot-compare.png (위 일반 / 아래 공공, 라벨 포함, 폭을 맞추지 않고 원본 픽셀 그대로 위아래로 쌓는다)
푸터 영역 = 쪽 높이 1587px(CSS) 기준 아래 215px(푸터 201 + 여유) 를 래스터 픽셀 비율로 환산한다.
필요: pymupdf, Pillow, Windows 맑은 고딕
"""
import io
import sys
from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont

PAGE_CSS_H, FOOT_CSS_H = 1587.39, 215.0


def native_foot(pdf: str) -> Image.Image:
    doc = fitz.open(pdf)
    page = doc[0]
    xref = page.get_images()[0][0]
    info = doc.extract_image(xref)
    im = Image.open(io.BytesIO(info["image"])).convert("RGB")
    h = round(im.height * FOOT_CSS_H / PAGE_CSS_H)
    return im.crop((0, im.height - h, im.width, im.height))


def main() -> int:
    gen_pdf, pub_pdf, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 30)
    g, p = native_foot(gen_pdf), native_foot(pub_pdf)
    g.save(out / "foot-general-native.png")
    p.save(out / "foot-public-native.png")
    gap, label_h, pad = 24, 52, 24
    w = max(g.width, p.width) + pad * 2
    h = pad + label_h + g.height + gap + label_h + p.height + pad
    sheet = Image.new("RGB", (w, h), (154, 163, 171))
    d = ImageDraw.Draw(sheet)
    y = pad
    for label, im in (("위: 일반(AI·일반 견적서, 일반 기업용) — F2 브랜드 밴드 · PDF 래스터 원본 해상도", g), ("아래: 공공(공공 견적서) — F1 콜로폰 · PDF 래스터 원본 해상도", p)):
        d.text((pad, y + 8), f"{label}  [{im.width}x{im.height}px]", font=font, fill="white")
        y += label_h
        sheet.paste(im, (pad, y))
        y += im.height + gap
    sheet.save(out / "foot-compare.png")
    print("foot-compare", sheet.size, "general", g.size, "public", p.size)
    return 0


if __name__ == "__main__":
    sys.exit(main())
