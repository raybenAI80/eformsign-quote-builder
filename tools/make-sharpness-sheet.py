"""선명도 비교 시트: crop-spec.json 의 PDF 4종 1쪽을 600dpi 로 렌더해 세 위치를 원본 픽셀 그대로 잘라 붙인다.

사용: python tools/make-sharpness-sheet.py <폴더>   (폴더에 pdf-sharpness-compare.mjs 가 만든 PDF 와 crop-spec.json)
출력: <폴더>/sharpness-sheet.png (행=방식, 열=위치, 행 라벨 "방식 · 크기 MB · 생성 ms"), <폴더>/crop-<방식id>-<위치>.png
필요: pymupdf, Pillow, Windows 맑은 고딕(malgun.ttf)
크롭은 확대·축소하지 않는다(렌더 600dpi 픽셀 그대로). PDF 안 이미지 해상도·압축 정보도 함께 출력한다.
"""
import json
import sys
from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont

d = Path(sys.argv[1])
spec = json.loads((d / "crop-spec.json").read_text(encoding="utf-8"))
DPI = spec["dpi"]
zoom = DPI / 72
mm_to_pt = 72 / 25.4
COLS = [("note", "① 품목 표 작은 회색 글자"), ("band", "② 네이비 띠 위 흰 글자"), ("strength", "③ 하단 강점 숫자·설명")]

font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 30)
font_s = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 26)

rows = []
for v in spec["variants"]:
    doc = fitz.open(d / v["file"])
    page = doc[0]
    info = []
    for im in page.get_images(full=True):
        xref = im[0]
        info.append(f"{im[2]}x{im[3]} px · 스트림 {len(doc.xref_stream_raw(xref)) / 1024:.0f} KB")
    print(v["id"], "images:", info)
    crops = []
    for key, _ in COLS:
        r = spec["regions"][key]
        clip = fitz.Rect(r["x_mm"] * mm_to_pt, r["y_mm"] * mm_to_pt, (r["x_mm"] + r["w_mm"]) * mm_to_pt, (r["y_mm"] + r["h_mm"]) * mm_to_pt)
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip, alpha=False)
        im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        im.save(d / f"crop-{v['id']}-{key}.png")
        crops.append(im)
    rows.append((v, crops, info))

LABEL_W, PAD, HEAD_H = 600, 24, 70
col_w = [max(r[1][i].width for r in rows) for i in range(len(COLS))]
row_h = [max(c.height for c in r[1]) + PAD for r in rows]
W = LABEL_W + sum(col_w) + PAD * (len(COLS) + 1)
H = HEAD_H + sum(row_h) + PAD
sheet = Image.new("RGB", (W, H), (154, 163, 171))
dr = ImageDraw.Draw(sheet)
x = LABEL_W + PAD
for i, (_, title) in enumerate(COLS):
    dr.text((x, 20), title, font=font, fill=(255, 255, 255))
    x += col_w[i] + PAD
dr.text((PAD, 24), f"1쪽 {DPI}dpi 원본 픽셀 크롭 (확대·축소 없음)", font=font_s, fill=(255, 255, 255))
y = HEAD_H
for (v, crops, info), rh in zip(rows, row_h):
    mb = v["bytes"] / 1048576
    dr.text((PAD, y + 6), v["label"], font=font, fill=(255, 255, 255))
    dr.text((PAD, y + 50), f"{mb:.2f} MB · {v['ms_median']} ms", font=font_s, fill=(255, 255, 255))
    dr.text((PAD, y + 90), info[0] if info else "", font=font_s, fill=(235, 240, 245))
    x = LABEL_W + PAD
    for i, im in enumerate(crops):
        sheet.paste(im, (x, y))
        x += col_w[i] + PAD
    y += rh
sheet.save(d / "sharpness-sheet.png")
print("sheet", sheet.size, d / "sharpness-sheet.png")
