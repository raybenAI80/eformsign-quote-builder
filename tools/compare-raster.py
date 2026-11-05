"""두 출력물(PDF 첫 쪽 또는 PNG)을 같은 크기 래스터로 맞춰 다른 픽셀 비율을 구한다.
사용: python -I compare-raster.py <기준> <비교> [--save <비교 첫 쪽 PNG 경로>]
출력 한 줄: diff=<다른 픽셀 비율> size=<가로x세로>. 서식이 빠진 PDF 는 기준과 크게 달라 0.1 이상이 나온다.
PDF 는 pymupdf(시스템 python)로 렌더한다. PYI 환경변수를 비운 셸에서 실행한다."""
import sys
import fitz

args = [a for a in sys.argv[1:] if not a.startswith("--")]
save = None
if "--save" in sys.argv:
    save = sys.argv[sys.argv.index("--save") + 1]
    args = [a for a in args if a != save]


def load(path):
    if path.lower().endswith(".pdf"):
        page = fitz.open(path)[0]
        zoom = 60 / 72  # PDF 는 같은 배율로 렌더하므로 같은 쪽 크기면 같은 픽셀 크기가 나온다
        return page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    pix = fitz.Pixmap(path)
    if pix.width > 1200:
        pix.shrink(2)  # 큰 PNG 는 가로세로 4분의 1 로 줄여 비교 시간을 줄인다
    return pix


base = load(args[0])
other = load(args[1])
if save:
    other.save(save)
if (base.width, base.height) != (other.width, other.height):
    print(f"diff=1.000 size-mismatch {base.width}x{base.height} vs {other.width}x{other.height}")
    sys.exit(0)
if base.n != other.n:
    base = fitz.Pixmap(fitz.csRGB, base)
    other = fitz.Pixmap(fitz.csRGB, other)
a, b, n = base.samples, other.samples, base.n
total = base.width * base.height
diff = 0
for i in range(0, total * n, n):
    if abs(a[i] - b[i]) > 48 or abs(a[i + 1] - b[i + 1]) > 48 or abs(a[i + 2] - b[i + 2]) > 48:
        diff += 1
print(f"diff={diff / total:.4f} size={base.width}x{base.height}")
