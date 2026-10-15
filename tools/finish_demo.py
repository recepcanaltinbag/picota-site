"""Finish data/demo.json: CARD names for ARO hits, the hand layout, and what each cycle was built as.

Usage: finish_demo.py demo.json layout.json card.json
"""
import json, re, sys

demo_path, layout_path, card_path = sys.argv[1:4]
demo = json.load(open(demo_path))
layout = json.load(open(layout_path))
card = json.load(open(card_path))
aro = {f"ARO:{m['ARO_accession']}": m['model_name'] for m in card.values() if isinstance(m, dict) and 'ARO_accession' in m}

for s in demo['segments']:
    s['x'], s['y'] = layout[s['id']]

# What the graph was drawn to contain; PICOTA is not told any of this.
BUILT_AS = {
    'IS26': ('planted', 'Composite transposon: IS26 – TEM-1, APH(3′)-Ia – IS26'),
    'IS10': ('planted', 'Composite transposon: IS10 – tet(B) – IS10, as in Tn10'),
    'rrn': ('decoy', 'Host repeat: two copies of an rRNA-like operon, no IS'),
    'IS1': ('decoy', 'IS1 flanking a 26 kb genomic island'),
}
for c in demo['cycles']:
    for f in c['features']:
        if f.get('name'):
            f['name'] = re.sub(r'ARO:\d+', lambda m: aro.get(m.group(0), m.group(0)), f['name'])
    first = c['path'][0][:-1]
    c['truth'], c['truth_note'] = BUILT_AS.get(first, (None, None))

demo['title'] = 'Demo graph'
demo['scoring_note'] = ('An illustrative graph drawn by hand from real IS and CARD sequences, '
                        'not an assembly. Cycles and scores are PICOTA 1.1.0 run on it.')
demo['dropped_note'] = ('The chromosome itself closes a ~60 kb cycle; detection drops it at the '
                        '40 kb size limit. The SNP bubble is two parallel paths, not a cycle.')
json.dump(demo, open(demo_path, 'w'), separators=(',', ':'))
for c in demo['cycles']:
    print(c['name'], c['score3'], c['truth'], [f.get('name') for f in c['features'] if f['k'] != 'orf'])
