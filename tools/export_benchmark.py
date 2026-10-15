"""Convert Supplementary Data 1 (simulated benchmark) into data/benchmark.json.

Only what the site shows is exported: the summary tables, and a small preview
of the implanted elements (PER_GROUP per group, without chromosome
coordinates). The full element table stays in the supplementary file.
"""
import json, sys
import openpyxl

PER_GROUP = 2
DROP = {'Start', 'End'}

src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)

def table(name):
    rows = [r for r in wb[name].iter_rows(values_only=True) if any(c is not None for c in r)]
    return {'columns': list(rows[0]), 'rows': [list(r) for r in rows[1:]]}

el = table('Implanted elements')
keep = [i for i, c in enumerate(el['columns']) if c not in DROP]
exp_code = {'architectures (Figure 3a)': 'a', 'copy number': 'c'}
total = len(el['rows'])
taken, preview = {}, []
for r in el['rows']:
    group = r[1]
    if taken.get(group, 0) >= PER_GROUP:
        continue
    taken[group] = taken.get(group, 0) + 1
    r = [r[i] for i in keep]
    r[0] = exp_code.get(r[0], r[0])
    preview.append(r)

json.dump({
    'architectures': table('Figure 3a'),
    'copy_number': table('Figure 3b'),
    'negative_control': table('Negative control'),
    'elements': {'columns': [el['columns'][i] for i in keep], 'rows': preview,
                 'total': total, 'groups': len(taken)},
}, open(out, 'w'), separators=(',', ':'))
