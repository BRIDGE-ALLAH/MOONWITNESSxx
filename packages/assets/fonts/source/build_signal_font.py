#!/usr/bin/env python3
"""Build the original MOONWITNESS Signal Display font from editable vector strokes."""
from __future__ import annotations
import json, math
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / "moonwitness-signal-glyphs.json").read_text(encoding="utf-8"))
OUT = ROOT.parent / "MOONWITNESS-SignalDisplay-SemiBold.woff2"
OUT_TTF = ROOT.parent / "MOONWITNESS-SignalDisplay-SemiBold.ttf"
UPM, GRID, GLYPHS = int(DATA["unitsPerEm"]), DATA["grid"], DATA["glyphs"]

def build_glyph(segments):
    pen = TTGlyphPen(None)
    scale, ox, oy, stroke = int(GRID["x"]), int(GRID["originX"]), int(GRID["originY"]), float(GRID["strokeWidth"])
    for x1, y1, x2, y2 in segments:
        x1, y1, x2, y2 = ox+x1*scale, oy+y1*scale, ox+x2*scale, oy+y2*scale
        dx, dy = x2-x1, y2-y1
        length = math.hypot(dx, dy)
        if not length: continue
        nx, ny = -dy/length*stroke/2, dx/length*stroke/2
        points = [(round(x1+nx),round(y1+ny)),(round(x2+nx),round(y2+ny)),(round(x2-nx),round(y2-ny)),(round(x1-nx),round(y1-ny))]
        pen.moveTo(points[0])
        for point in points[1:]: pen.lineTo(point)
        pen.closePath()
    return pen.glyph()

def main():
    order = [".notdef","space"] + [f"uni{ord(c):04X}" for c in GLYPHS]
    glyphs, metrics = {}, {}
    pen = TTGlyphPen(None)
    pen.moveTo((80,0)); pen.lineTo((80,800)); pen.lineTo((700,800)); pen.lineTo((700,0)); pen.closePath()
    pen.moveTo((150,80)); pen.lineTo((630,80)); pen.lineTo((630,720)); pen.lineTo((150,720)); pen.closePath()
    glyphs[".notdef"], metrics[".notdef"] = pen.glyph(), (800,50)
    glyphs["space"], metrics["space"] = TTGlyphPen(None).glyph(), (430,0)
    for c, segments in GLYPHS.items():
        name = f"uni{ord(c):04X}"
        glyphs[name] = build_glyph(segments)
        metrics[name] = (760 if c in ".,:;!' " else 900,50)
    fb = FontBuilder(UPM,isTTF=True)
    fb.setupGlyphOrder(order)
    cmap = {ord(c):f"uni{ord(c):04X}" for c in GLYPHS}
    cmap[32] = "space"
    for c in "abcdefghijklmnopqrstuvwxyz": cmap[ord(c)] = f"uni{ord(c.upper()):04X}"
    fb.setupCharacterMap(cmap); fb.setupGlyf(glyphs); fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=900,descent=-180)
    fb.setupNameTable({"familyName":"MOONWITNESS Signal Display","styleName":"SemiBold","uniqueFontIdentifier":"MOONWITNESS Signal Display SemiBold v0.1","fullName":"MOONWITNESS Signal Display SemiBold","psName":"MOONWITNESSSignalDisplay-SemiBold","version":"Version 0.100","manufacturer":"MOONWITNESS","designer":"MOONWITNESS","description":"Original geometric observatory display typeface for MOONWITNESS.","licenseDescription":"Internal project use only. Unlicensed for external redistribution pending owner approval."})
    fb.setupOS2(sTypoAscender=900,sTypoDescender=-180,usWinAscent=900,usWinDescent=180,usWeightClass=600,usWidthClass=5)
    fb.setupPost(); fb.setupMaxp()
    font = fb.font
    font.save(OUT_TTF)
    font.flavor = "woff2"; font.save(OUT)
    print(f"Built {OUT_TTF} and {OUT}")

if __name__ == "__main__": main()
