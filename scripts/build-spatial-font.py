"""Build editable spatial-title outlines from the bundled licensed DejaVu font.

Rebuild with: python scripts/build-spatial-font.py
The original DejaVu license is in public/fonts/DejaVuSans-LICENSE.txt.
No executable font contents or user-provided paths are evaluated at runtime.
"""
from pathlib import Path
import json
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

root = Path(__file__).resolve().parents[1]
font = TTFont(root / "public/fonts/DejaVuSans.ttf")
glyphs = font.getGlyphSet()
units = font["head"].unitsPerEm


class PolygonPen(BasePen):
    def __init__(self):
        super().__init__(glyphs)
        self.contours = []
        self.current = []

    def point(self, p):
        self.current.append([round(p[0] / units, 4), round(-p[1] / units, 4)])

    def _moveTo(self, p):
        self.current = []
        self.contours.append(self.current)
        self.point(p)

    def _lineTo(self, p):
        self.point(p)

    def _qCurveToOne(self, control, end):
        start = self._getCurrentPoint()
        for step in range(1, 7):
            t = step / 6
            self.point(tuple((1-t)**2 * start[i] + 2*(1-t)*t*control[i] + t*t*end[i] for i in range(2)))

    def _curveToOne(self, a, b, end):
        start = self._getCurrentPoint()
        for step in range(1, 9):
            t = step / 8
            self.point(tuple((1-t)**3*start[i]+3*(1-t)**2*t*a[i]+3*(1-t)*t*t*b[i]+t**3*end[i] for i in range(2)))

    def _closePath(self):
        pass

    def _endPath(self):
        pass


cmap = font.getBestCmap()
codes = list(range(32, 256)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x20AC]
result = {}
for code in codes:
    name = cmap.get(code)
    if not name:
        continue
    pen = PolygonPen()
    glyphs[name].draw(pen)
    result[chr(code)] = {"advance": round(glyphs[name].width / units, 4), "contours": pen.contours}
(root / "contracts/spatial-font.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"Built {len(result)} spatial title glyphs.")
