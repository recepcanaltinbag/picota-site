"""Finish data/demo.json: CARD names for ARO hits, and what each cycle was built as.

Usage: finish_demo.py demo.json truth.json card.json
  truth.json  written by make_demo_gfa.py: the segment ids of the planted pieces
"""
import json, re, sys

demo_path, truth_path, card_path = sys.argv[1:4]
demo = json.load(open(demo_path))
truth = json.load(open(truth_path))
card = json.load(open(card_path))
aro = {f"ARO:{m['ARO_accession']}": m['model_name'] for m in card.values() if isinstance(m, dict) and 'ARO_accession' in m}

# The two elements planted in the genome; PICOTA is not told any of this.
PLANTED = {
    frozenset([truth['IS26'], truth['ct1_cargo']]): 'IS26 – TEM-1, APH(3′)-Ia – IS26, planted in the chromosome',
    frozenset([truth['IS10'], truth['ct2_cargo']]): 'IS10 – tet(B) – IS10, a Tn10-like element planted in the chromosome',
}
for c in demo['cycles']:
    for f in c['features']:
        if f.get('name'):
            f['name'] = re.sub(r'ARO:\d+', lambda m: aro.get(m.group(0), m.group(0)), f['name'])
    nodes = frozenset(p[:-1] for p in c['path'])
    if nodes in PLANTED:
        c['truth'], c['truth_note'] = 'planted', PLANTED[nodes]
    else:
        c['truth'] = 'decoy'
        c['truth_note'] = ('A walk through host repeats with no IS on it.' if c['no_is'] else
                           'Runs through a host IS, but its length and the number of components it threads mark it as the host\'s own repeat structure.')

demo['scoring_note'] = ('A synthetic graph built the way an assembly graph comes out of a genome with repeats, '
                        'from real IS and CARD sequences; not an assembly. Cycles and scores are PICOTA 1.1.0 run on it.')
json.dump(demo, open(demo_path, 'w'), separators=(',', ':'))
print(len(demo['cycles']), 'cycles;', sum(c['truth'] == 'planted' for c in demo['cycles']), 'planted;',
      sum(c['reported'] for c in demo['cycles']), 'reported')
