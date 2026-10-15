"""Add PICOTA's scoring of the testNitro cycles to data/nitro.json.

Usage: export_scores.py nitro.json scoring_dir prodigal_dir
  scoring_dir   output of `picota scoring` run with threshold_final_score: 0,
                holding picota_final_tab and one annotated .gbk per scored cycle
  prodigal_dir  Pico_Temp/Prodigal_Out/<sample>, one .gbk of ORFs per cycle
"""
import csv, glob, json, os, re, sys
from Bio import SeqIO

nitro_path, score_dir, prod_dir = sys.argv[1:4]
data = json.load(open(nitro_path))
seg_len = {s['id']: s['len'] for s in data['segments']}
OVERLAP = 59  # every link in testNitro.gfa is 59M

def key(name):  # 'Cycle_reverseoriented_4-len7980-comp9-' -> '4'
    return name.split('-')[0].split('_')[-1]

tab = {}
f = glob.glob(os.path.join(score_dir, '**', 'picota_final_tab'), recursive=True)[0]
for r in csv.DictReader(open(f), delimiter='\t'):
    tab[key(r['CycleID'])] = r

def kind(res_type):
    return {'InsertionSequences': 'is', 'Antibiotics': 'amr', 'Xenobiotics': 'xeno', 'CompTNs': 'ct'}.get(res_type, 'orf')

for idx, c in enumerate(data['cycles']):
    k = key(c['name'])
    # contig spans along the cycle sequence: each node adds its length minus the link overlap
    pos, spans = 0, []
    for j, node in enumerate(c['path']):
        L = seg_len[node[:-1]] - (OVERLAP if j else 0)
        spans.append({'node': node, 'start': pos + 1, 'end': pos + L})
        pos += L
    c['spans'] = spans
    c['span_total'] = pos
    feats = []
    gbk = glob.glob(os.path.join(prod_dir, c['name'] + '*.gbk'))
    # Prodigal's GenBank output has no LOCUS line, so read the CDS lines directly
    for line in open(gbk[0]) if gbk else []:
        m = re.match(r'\s+CDS\s+(complement\()?<?(\d+)\.\.>?(\d+)', line)
        if m:
            feats.append({'s': int(m.group(2)), 'e': int(m.group(3)), 'str': -1 if m.group(1) else 1, 'k': 'orf'})
    ann = glob.glob(os.path.join(score_dir, '**', c['name'] + '*.gbk'), recursive=True)
    ann = [a for a in ann if 'Pico_Temp' not in a]
    for rec in SeqIO.parse(ann[0], 'genbank') if ann else []:
        for ft in rec.features:
            rt = ft.qualifiers.get('res_type', [None])[0]
            if ft.type != 'CDS' or not rt:
                continue
            s, e = int(ft.location.start) + 1, int(ft.location.end)
            feats = [x for x in feats if not (x['k'] == 'orf' and x['s'] < e and x['e'] > s and kind(rt) != 'is')]
            feats.append({'s': s, 'e': e, 'str': ft.location.strand or 1, 'k': kind(rt),
                          'name': ft.qualifiers.get('product', [''])[0].replace(' ', '')})
    c['features'] = sorted(feats, key=lambda x: x['s'])
    r = tab.get(k)
    c['score3'] = round(float(r['score3']), 1) if r else 0.0
    c['reported'] = c['score3'] >= 50
    c['category'] = r['CompTN'] if r else None
    c['no_is'] = r is None
    print(c['name'], c['score3'], len(c['features']), 'span_total', pos, 'len', c['len'],
          [f'{x["k"]}:{x.get("name","")}' for x in c['features'] if x['k'] != 'orf'])

data['scoring_note'] = ('score3 from PICOTA 1.1.0 on this graph with CARD 3.2.7 (protein homolog models), '
                        'the ISfinder/TnCentral IS set and the known composite transposons; the xenobiotic '
                        'set was the curated one only, not the full KEGG-derived set.')
json.dump(data, open(nitro_path, 'w'), separators=(',', ':'))
