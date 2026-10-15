"""Convert Supplementary Data 1 (simulated benchmark) into data/benchmark.json.

Only the summary tables the site shows are exported; the per-element table is
left out.
"""
import json, sys
import openpyxl

src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)

def table(name):
    rows = [r for r in wb[name].iter_rows(values_only=True) if any(c is not None for c in r)]
    return {'columns': list(rows[0]), 'rows': [list(r) for r in rows[1:]]}

json.dump({
    'architectures': table('Figure 3a'),
    'copy_number': table('Figure 3b'),
    'negative_control': table('Negative control'),
}, open(out, 'w'), separators=(',', ':'))
