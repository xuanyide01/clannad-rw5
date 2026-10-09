"""Verify every complete rare-glyph text field is covered by the packaged font."""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
root=Path(__file__).resolve().parents[1]
report=json.loads((root/'reports/text-font.json').read_text(encoding='utf-8'))
cmap=TTFont(root/'src/common/clannad-extra.otf').getBestCmap()
assert sorted(cmap)==report['codepoints']
triggers=set(report['missingDefaultGlyphs']);checked=0
def visit(value):
    global checked
    if isinstance(value,str) and triggers.intersection(value):
        value=value.replace('・','·');assert all(ch.isspace() or ord(ch) in cmap for ch in value),value;checked+=1
    elif isinstance(value,list):
        for item in value:visit(item)
    elif isinstance(value,dict):
        for item in value.values():visit(item)
for p in (root/'src/common/story').rglob('*.txt'):visit(json.loads(p.read_text(encoding='utf-8')))
visit(json.loads((root/'src/common/gallery.txt').read_text(encoding='utf-8')))
visit(json.loads((root/'src/common/catalog.js').read_text(encoding='utf-8').removeprefix('export const catalog=').strip().removesuffix(';')))
assert checked==report['affectedStrings']
assert all(ord(ch) in cmap for ch in '柊胜平芳野祐介紬') if '紬' in triggers else all(ord(ch) in cmap for ch in '柊胜平芳野祐介')
print('FONT_COVERAGE_PASSED',checked,len(cmap))
