"""Write an illustrative assembly graph for the site's demo.

Not an assembly: a small GFA drawn by hand to show what PICOTA looks for, built
from real sequences so that PICOTA's own detection and scoring can be run on it.

  a circular chromosome of five stretches of random sequence, closing one
  ~60 kb cycle that the 40 kb size limit drops;
  two composite transposons -- IS26 with TEM-1 and APH(3')-Ia, and IS10 with
  tet(B) as in Tn10 -- each a few-kb cycle through its collapsed IS node;
  an rRNA-like repeat with the stretch between its copies: a cycle with no IS;
  IS1 with a 26 kb island: a cycle with an IS but far longer than a composite
  transposon;
  a SNP bubble: two parallel paths, which is not a cycle.

Usage: make_demo_gfa.py IS_db.fasta card.json out.gfa layout.json
Sequence IDs avoid '+' and '-', which PICOTA reads as strand signs.
"""
import json, math, random, sys

is_db, card_json, out_gfa, out_layout = sys.argv[1:5]
rng = random.Random(7)

def fasta(path):
    name, chunks = None, []
    for line in open(path):
        line = line.strip()
        if line.startswith('>'):
            if name:
                yield name, ''.join(chunks)
            name, chunks = line[1:].split()[0], []
        elif line:
            chunks.append(line)
    if name:
        yield name, ''.join(chunks)

def filler(n, gc=0.5):
    return ''.join(rng.choice('GC' if rng.random() < gc else 'AT') for _ in range(n))

is_seqs = dict(fasta(is_db))
IS26 = is_seqs['IS26-MH257753'].upper()
IS1 = is_seqs['ISFinder_IS1A'].upper()
IS10 = is_seqs['IS10L-AF162223'].upper()

card = json.load(open(card_json))
def card_gene(name):
    for m in card.values():
        if isinstance(m, dict) and m.get('model_name') == name:
            return next(iter(m['model_sequences']['sequence'].values()))['dna_sequence']['sequence'].upper()
    raise KeyError(name)
TEM1, APH, TETB = card_gene('TEM-1'), card_gene("APH(3')-Ia"), card_gene('tet(B)')

# segment id -> (sequence, read depth)
S = {
    'chr_a': (filler(9000), 30),
    'IS26': (IS26, 60),
    'cargo': (filler(450) + TEM1 + filler(380) + APH + filler(420), 30),
    'chr_b': (filler(7000), 30),
    'snp_1': (filler(300), 15),
    'chr_c': (filler(10000), 30),
    'rrn': (filler(5000, 0.53), 60),
    'spacer': (filler(4200), 30),
    'chr_d': (filler(8000), 30),
    'IS1': (IS1, 60),
    'island': (filler(26000, 0.44), 30),
    'chr_e': (filler(5000), 30),
    'IS10': (IS10, 60),
    'tet_cargo': (filler(520) + TETB + filler(610), 30),
    'chr_f': (filler(5000), 30),
}
# the SNP bubble: the alternative allele differs from snp_1 at one base
ref = S['snp_1'][0]
S['snp_2'] = (ref[:150] + ('A' if ref[150] != 'A' else 'C') + ref[151:], 15)

links = [
    ('chr_a', 'IS26'), ('IS26', 'cargo'), ('cargo', 'IS26'), ('IS26', 'chr_b'),
    ('chr_b', 'snp_1'), ('chr_b', 'snp_2'), ('snp_1', 'chr_c'), ('snp_2', 'chr_c'),
    ('chr_c', 'rrn'), ('rrn', 'spacer'), ('spacer', 'rrn'), ('rrn', 'chr_d'),
    ('chr_d', 'IS1'), ('IS1', 'island'), ('island', 'IS1'), ('IS1', 'chr_e'),
    ('chr_e', 'IS10'), ('IS10', 'tet_cargo'), ('tet_cargo', 'IS10'), ('IS10', 'chr_f'),
    ('chr_f', 'chr_a'),
]

with open(out_gfa, 'w') as f:
    f.write('H\tVN:Z:1.0\n')
    for sid, (seq, depth) in S.items():
        f.write(f'S\t{sid}\t{seq}\tKC:i:{depth * len(seq)}\n')
    for a, b in links:
        f.write(f'L\t{a}\t+\t{b}\t+\t0M\n')

# Fixed positions: the chromosome around a circle, each loop hanging outside its repeat.
ring = ['chr_a', 'IS26', 'chr_b', 'snp_1', 'chr_c', 'rrn', 'chr_d', 'IS1', 'chr_e', 'IS10', 'chr_f']
pos = {}
for i, sid in enumerate(ring):
    a = -math.pi / 2 + i / len(ring) * 2 * math.pi
    pos[sid] = (230 * math.cos(a), 230 * math.sin(a))
def outward(sid, r):
    x, y = pos[sid]; L = math.hypot(x, y)
    return (x / L * r, y / L * r)
pos['cargo'] = outward('IS26', 360)
pos['spacer'] = outward('rrn', 360)
pos['island'] = outward('IS1', 380)
pos['tet_cargo'] = outward('IS10', 360)
x, y = pos['snp_1']; L = math.hypot(x, y)
pos['snp_1'] = (x / L * 200, y / L * 200)
pos['snp_2'] = (x / L * 262, y / L * 262)
json.dump({k: [round(v[0], 1), round(v[1], 1)] for k, v in pos.items()}, open(out_layout, 'w'))
print({k: len(v[0]) for k, v in S.items()})
