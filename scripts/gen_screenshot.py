#!/usr/bin/env python3
"""Render a faithful preview of the MeaLog desktop UI to a PNG for the README.

We can't run a headless browser in this environment, so this script rebuilds the
real UI (same dark theme tokens, sidebar, month feed and inline meal table) as an
SVG and rasterizes it with cairosvg. Sample data mirrors mealog_backup_*.json.
"""
import cairosvg

# --- design tokens (from src/styles/index.css) ---
BG1 = "#191919"   # --bg-primary
BG2 = "#202020"   # --bg-secondary (sidebar)
BG3 = "#2C2C2C"   # --bg-tertiary
TXT1 = "#FFFFFF"
TXT2 = "#A0A0A0"
TXT3 = "#666666"
BORDER = "#333333"
RED = "#EB5757"
FONT = "Noto Sans CJK KR, sans-serif"

W, H = 1280, 824
SBW = 240  # sidebar width

# meal type -> (label, color)  (from InlineMealTable.jsx)
TYPES = {
    "breakfast": ("아침", "#2F80ED"),
    "lunch": ("점심", "#F2C94C"),
    "dinner": ("저녁", "#27AE60"),
    "snack": ("간식", "#EB5757"),
    "healthy": ("건강식", "#56CCF2"),
    "cheat": ("치팅데이", "#BB6BD9"),
}

s = []
def add(x): s.append(x)

def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def text(x, y, t, size, color, weight="400", anchor="start"):
    add(f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
        f'fill="{color}" font-weight="{weight}" text-anchor="{anchor}">{esc(t)}</text>')

def rect(x, y, w, h, fill, rx=0, stroke=None, sw=1, opacity=None):
    o = f' fill-opacity="{opacity}"' if opacity is not None else ""
    st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{o}{st}/>')

add(f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">')
# base
rect(0, 0, W, H, BG1)

# ---------------- Sidebar ----------------
rect(0, 0, SBW, H, BG2)
add(f'<line x1="{SBW}" y1="0" x2="{SBW}" y2="{H}" stroke="{BORDER}" stroke-width="1"/>')
# logo
rect(16, 20, 20, 20, RED, rx=4)
text(26, 35, "", 12, "#fff", anchor="middle")
text(44, 35, "MeaLog", 15, TXT1, weight="600")
# YEARS label
text(16, 78, "YEARS", 12, TXT2, weight="600")
# 2026 MeaLog tree row
rect(8, 90, 224, 30, BG3, rx=4)
# chevron (down)
add('<path d="M 22 102 l 5 5 l 5 -5" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
# doc icon
rect(36, 98, 11, 14, "none", rx=1, stroke="#fff", sw=1.3)
text(56, 110, "2026 MeaLog", 13, TXT1)
# months
months = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"]
my = 134
for i, m in enumerate(months):
    sel = (i == 0)
    yy = my + i * 27
    if sel:
        rect(36, yy, 196, 24, "#FFFFFF", rx=4, opacity=0.05)
    text(48, yy + 16, m, 13, TXT1 if sel else TXT2, weight="500" if sel else "400")

# bottom block (sync + backup/import)
by = H - 96
add(f'<line x1="16" y1="{by-14}" x2="{SBW-16}" y2="{by-14}" stroke="{BORDER}" stroke-width="1"/>')
# sync status
add(f'<circle cx="20" cy="{by}" r="4" fill="#27AE60"/>')
text(34, by + 4, "동기화됨 · 방금", 12, TXT2)
# backup
add(f'<circle cx="20" cy="{by+30}" r="4" fill="#27AE60"/>')
text(34, by + 34, "Backup Data (JSON)", 12, TXT2)
# import
add(f'<circle cx="20" cy="{by+58}" r="4" fill="#2D9CDB"/>')
text(34, by + 62, "Import Data (JSON)", 12, TXT2)

# ---------------- Main content ----------------
CX = 300          # content left
CW = 820          # content width
# month title
text(CX, 96, "1월", 46, TXT1, weight="700")
add(f'<line x1="{CX}" y1="120" x2="{CX+CW}" y2="120" stroke="{BORDER}" stroke-width="1"/>')

# table column layout (sums to CW)
cols = [230, 105, 95, 85, 80, 90, 100, 35]
heads = ["음식", "칼로리(Kcal)", "단백질(g)", "탄수(g)", "지방(g)", "섭취량(g)", "식사 종류", ""]
xs = [CX]
for c in cols:
    xs.append(xs[-1] + c)

def draw_pill_type(x, cy, type_id):
    label, color = TYPES[type_id]
    pw = 56
    rect(x, cy - 11, pw, 22, color, rx=11, opacity=0.18)
    text(x + pw/2, cy + 4, label, 12, color, weight="600", anchor="middle")

def draw_table(top, day_label, rows, sums):
    # day header
    text(CX, top, day_label, 26, TXT1, weight="700")
    # camera pill (right)
    pw = 118
    rect(CX + CW - pw, top - 19, pw, 26, "none", rx=13, stroke=BORDER, sw=1)
    add(f'<rect x="{CX+CW-pw+12}" y="{top-12}" width="12" height="10" rx="2" fill="none" stroke="{RED}" stroke-width="1.4"/>')
    add(f'<circle cx="{CX+CW-pw+18}" cy="{top-7}" r="2.3" fill="none" stroke="{RED}" stroke-width="1.4"/>')
    text(CX + CW - pw + 32, top + 1, "사진으로 추가", 12, TXT2, weight="600")

    hy = top + 34
    # header labels
    for i, hdr in enumerate(heads):
        if hdr:
            text(xs[i], hy, hdr, 12.5, TXT2, weight="600")
    add(f'<line x1="{CX}" y1="{hy+12}" x2="{CX+CW}" y2="{hy+12}" stroke="{BORDER}" stroke-width="1"/>')

    ry = hy + 42
    for r in rows:
        text(xs[0], ry + 5, r["name"], 14.5, TXT1, weight="500")
        text(xs[1], ry + 5, str(r["calories"]), 14, TXT1)
        text(xs[2], ry + 5, str(r["protein"]), 14, TXT1)
        text(xs[3], ry + 5, r.get("carbs", "—") or "—", 14, TXT3)
        text(xs[4], ry + 5, r.get("fat", "—") or "—", 14, TXT3)
        text(xs[5], ry + 5, r.get("intake", "—") or "—", 14, TXT3)
        draw_pill_type(xs[6], ry, r["type"])
        # delete icon (trash) faint
        add(f'<path d="M {xs[7]+6} {ry-5} h 10 M {xs[7]+7} {ry-2} v 9 m 3 -9 v 9 m 3 -9 v 9" stroke="{TXT3}" stroke-width="1.2" fill="none" stroke-linecap="round"/>')
        add(f'<line x1="{CX}" y1="{ry+18}" x2="{CX+CW}" y2="{ry+18}" stroke="{BORDER}" stroke-width="1" stroke-opacity="0.5"/>')
        ry += 44
    # ghost row (faint placeholder)
    text(xs[0], ry + 5, "음식 추가…", 14, TXT3)
    ry += 40
    # summary row
    add(f'<line x1="{CX}" y1="{ry-6}" x2="{CX+CW}" y2="{ry-6}" stroke="{BORDER}" stroke-width="1"/>')
    parts = [f"칼로리 합 {sums['cal']} kcal", f"단백질 합 {sums['protein']} g",
             f"탄수 합 {sums['carbs']} g", f"지방 합 {sums['fat']} g"]
    seg = CW / 4
    for i, p in enumerate(parts):
        text(CX + seg*i + seg/2, ry + 18, p, 13, TXT2, weight="500", anchor="middle")
    return ry + 40

rows1 = [
    {"name": "쉐이크", "calories": 115, "protein": 21, "type": "breakfast"},
    {"name": "샐러드, 닭가슴살", "calories": 200, "protein": 22, "type": "lunch"},
    {"name": "감자탕", "calories": 295, "protein": 30, "type": "dinner"},
]
next_top = draw_table(170, "8일", rows1, {"cal": 610, "protein": 73, "carbs": 0, "fat": 0})

rows2 = [
    {"name": "견과류", "calories": 191, "protein": 6, "type": "breakfast"},
    {"name": "고기 파티", "calories": 1400, "protein": 90, "type": "cheat"},
]
draw_table(next_top + 40, "9일", rows2, {"cal": 1591, "protein": 96, "carbs": 0, "fat": 0})

# floating "오늘" button
bw, bx, byy = 78, CX + CW - 78, H - 60
rect(bx, byy, bw, 38, RED, rx=19)
rect(bx + 16, byy + 12, 13, 12, "none", rx=2, stroke="#fff", sw=1.4)
add(f'<line x1="{bx+19}" y1="{byy+10}" x2="{bx+19}" y2="{byy+14}" stroke="#fff" stroke-width="1.4"/>')
add(f'<line x1="{bx+26}" y1="{byy+10}" x2="{bx+26}" y2="{byy+14}" stroke="#fff" stroke-width="1.4"/>')
text(bx + 40, byy + 24, "오늘", 13, "#fff", weight="600")

add('</svg>')
svg = "\n".join(s)

with open("docs/screenshot.svg", "w", encoding="utf-8") as f:
    f.write(svg)
cairosvg.svg2png(bytestring=svg.encode("utf-8"),
                 write_to="docs/screenshot.png",
                 output_width=W*2, output_height=H*2)
print("wrote docs/screenshot.png")
