"""견적서 출력물 글꼴 준비 스크립트.

화면용 woff2 4종(Paperlogy 6/8, Pretendard Regular/SemiBold)을 public/fonts/design-d/ 로 복사하고,
PDF 텍스트 레이어(jsPDF)용 TTF 를 woff2 에서 만든다. jsPDF 는 woff2 를 못 읽고 TrueType(glyf) 윤곽만 쓴다.
Pretendard TTF 는 한글 완성형 11172자 + 라틴·기호만 남기는 서브셋이다(원본 2.7MB -> 2.1MB).
Paperlogy 는 원본 글리프 집합이 이미 작아 전체를 그대로 변환한다.

사용: python tools/build-design-fonts.py <woff2 원본 폴더>
필요: fonttools, brotli (가상환경에 설치)
원본 woff2 출처: jsDelivr gh/projectnoonnu/2408-3@1.0 (Paperlogy), npm/pretendard@1.3.9 (Pretendard). 둘 다 SIL OFL 1.1.
"""
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

FACES = ["Paperlogy-6SemiBold", "Paperlogy-8ExtraBold", "Pretendard-Regular", "Pretendard-SemiBold"]
OUT = Path(__file__).resolve().parent.parent / "public" / "fonts" / "design-d"

KEEP_RANGES = [
    (0x0020, 0x007E), (0x00A0, 0x00FF), (0x2000, 0x206F), (0x20A9, 0x20AC),
    (0x2100, 0x218F), (0x2190, 0x21FF), (0x2460, 0x24FF), (0x25A0, 0x25FF),
    (0x3000, 0x303F), (0x3130, 0x318F), (0x3200, 0x32FF), (0xAC00, 0xD7A3),
    (0xFF00, 0xFFEF),
]


def to_ttf(src: Path, dst: Path, keep_all: bool) -> None:
    font = TTFont(src)
    font.flavor = None
    if keep_all:
        font.save(dst)
        return
    unicodes = [c for lo, hi in KEEP_RANGES for c in range(lo, hi + 1)]
    opts = subset.Options()
    opts.layout_features = ["kern"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.hinting = False
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    font.save(dst)


def main() -> None:
    src_dir = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for face in FACES:
        shutil.copyfile(src_dir / f"{face}.woff2", OUT / f"{face}.woff2")
        ttf = OUT / f"{face}.ttf"
        to_ttf(src_dir / f"{face}.woff2", ttf, keep_all=face.startswith("Paperlogy"))
        print(face, ttf.stat().st_size)


if __name__ == "__main__":
    main()
