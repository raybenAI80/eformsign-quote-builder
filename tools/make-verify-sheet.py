"""검증 캡처 4장(01~04)을 2x2 시트(sheet.png, 폭 2400px)로 합치고 03-pdf.png 상단 1/3 을 03-pdf-top.png 로 자른다.

사용: python tools/make-verify-sheet.py <캡처 폴더>
필요: Pillow, Windows 맑은 고딕(malgun.ttf)
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

d = Path(sys.argv[1])
CELL, GAP, LABEL_H = 1170, 20, 44
font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 24)

items = [
    ("01-filled.png", "1. 입력 후 (견적일 2026-10-01 · 1개월 · 품목 3개)", CELL),
    ("02-reload.png", "2. 새로고침 후", CELL),
    ("03-pdf.png", "3. 단일 PDF 1쪽 (150dpi)", None),
    ("04-reset.png", "4. 초기화 후", CELL),
]


def fit(img, max_w, max_h=None):
    s = max_w / img.width
    if max_h is not None:
        s = min(s, max_h / img.height)
    return img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)


imgs = []
for name, label, w in items:
    im = Image.open(d / name).convert("RGB")
    imgs.append((label, fit(im, CELL, 1000) if w is None else fit(im, w)))

row1_h = max(imgs[0][1].height, imgs[1][1].height)
row2_h = max(imgs[2][1].height, imgs[3][1].height)
W = GAP * 3 + CELL * 2
H = GAP + (LABEL_H + row1_h) + GAP + (LABEL_H + row2_h) + GAP
sheet = Image.new("RGB", (W, H), (154, 163, 171))
draw = ImageDraw.Draw(sheet)
for i, (label, im) in enumerate(imgs):
    col, row = i % 2, i // 2
    x = GAP + col * (CELL + GAP)
    y = GAP + (0 if row == 0 else LABEL_H + row1_h + GAP)
    draw.text((x, y + 6), label, font=font, fill=(255, 255, 255))
    sheet.paste(im, (x + (CELL - im.width) // 2 if i == 2 else x, y + LABEL_H))
sheet.save(d / "sheet.png")
print("sheet", sheet.size)

pdf = Image.open(d / "03-pdf.png")
top = pdf.crop((0, 0, pdf.width, pdf.height // 3))
top.save(d / "03-pdf-top.png")
print("03-pdf-top", top.size)
