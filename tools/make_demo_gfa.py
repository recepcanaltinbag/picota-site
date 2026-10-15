"""Write the site's demo assembly graph.

Not an assembly, but built the way an assembly graph comes out of a genome with
repeats: lay out a circular chromosome with known repeats, then collapse
every copy of each repeat into one node, as a short-read assembler does. The
unique stretches between repeat copies become the contigs, and the links follow
the chromosome through each copy in its orientation. SNP bubbles and dead-end
tips are added on top. The result has the tangled shape of a real graph -- a
few hundred contigs, high-degree repeat nodes, cycles through host repeats --
with the answer known.

Repeats in the genome:
  two composite transposons, the answer: IS26 - TEM-1, APH(3')-Ia - IS26, and
  IS10 - tet(B) - IS10 as in Tn10, each IS present only in its element;
  host IS elements (IS1, IS3, IS5, IS30, IS186) at 2-3 copies, one IS1 pair
  26 kb apart around an island;
  four rRNA-like operons, some inverted;
  REP-like short repeats, 2-3 copies per family.

Sequences: IS elements from the ISfinder/TnCentral set, resistance genes from
CARD, everything else random.

Usage: make_demo_gfa.py IS_db.fasta card.json out.gfa truth.json
Segment ids are numbers, as SPAdes writes them; '+' and '-' never appear in one.
"""
import json, random, sys

is_db, card_json, out_gfa, out_truth = sys.argv[1:5]
rng = random.Random(2024)

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

def rand_seq(n, gc=0.5):
    return ''.join(rng.choice('GC' if rng.random() < gc else 'AT') for _ in range(n))

is_seqs = dict(fasta(is_db))
card = json.load(open(card_json))
def card_gene(name):
    for m in card.values():
        if isinstance(m, dict) and m.get('model_name') == name:
            return next(iter(m['model_sequences']['sequence'].values()))['dna_sequence']['sequence'].upper()
    raise KeyError(name)

# ---- repeat families: name -> (sequence, copies, kind)
fam = {
    'IS26': (is_seqs['IS26-MH257753'].upper(), 2, 'ct_is'),
    'IS10': (is_seqs['IS10L-AF162223'].upper(), 2, 'ct_is'),
    'IS1': (is_seqs['ISFinder_IS1A'].upper(), 3, 'host_is'),
    'IS3': (is_seqs['ISFinder_IS3F'].upper(), 2, 'host_is'),
    'IS5': (is_seqs['ISFinder_IS5B'].upper(), 3, 'host_is'),
    'IS30': (is_seqs['ISFinder_IS30H'].upper(), 2, 'host_is'),
    'IS186': (is_seqs['ISFinder_IS186A'].upper(), 2, 'host_is'),
    'rrn': (rand_seq(5000, 0.53), 4, 'rrn'),
}
for i in range(34):
    fam[f'REP{i + 1}'] = (rand_seq(rng.randint(110, 420), 0.56), rng.choice([2, 2, 2, 2, 3]), 'rep')

# ---- the chromosome as an ordered list of blocks
# ('U', length) unique stretch | ('R', family, orientation) | ('C', name, sequence) cargo
blocks = []
copies = [f for f, (_, n, kind) in fam.items() if kind not in ('ct_is',) for _ in range(n)
          if not (f == 'IS1')]          # IS1 is placed by hand below
copies += ['IS1']
rng.shuffle(copies)
for f in copies:
    blocks.append(('U', int(rng.lognormvariate(8.2, 0.75)) + 300))
    blocks.append(('R', f, rng.choice('++-') if fam[f][2] != 'rep' else rng.choice('+-')))

def insert_at(frac, items):
    i = int(frac * len(blocks)) // 2 * 2
    blocks[i:i] = items

TEM1, APH, TETB = card_gene('TEM-1'), card_gene("APH(3')-Ia"), card_gene('tet(B)')
insert_at(0.18, [('U', 6200), ('R', 'IS26', '+'),
                 ('C', 'ct1_cargo', rand_seq(450) + TEM1 + rand_seq(380) + APH + rand_seq(420)),
                 ('R', 'IS26', '+')])
insert_at(0.61, [('U', 5400), ('R', 'IS10', '-'),
                 ('C', 'ct2_cargo', rand_seq(520) + TETB + rand_seq(610)),
                 ('R', 'IS10', '-')])
insert_at(0.43, [('U', 3900), ('R', 'IS1', '+'), ('C', 'island', rand_seq(26000, 0.44)), ('R', 'IS1', '+')])

# ---- collapse into a graph
ids = iter(rng.sample(range(1000, 70000), 2000))
seg = {}            # id -> [sequence, copies]
links = set()
fam_id = {f: str(next(ids)) for f in fam}
for f, (sq, _, _) in fam.items():
    seg[fam_id[f]] = [sq, 0]
truth_nodes = {}

walk = []           # (id, orientation) along the chromosome
for b in blocks:
    if b[0] == 'R':
        seg[fam_id[b[1]]][1] += 1
        walk.append((fam_id[b[1]], b[2]))
    else:
        sid = str(next(ids))
        sq = b[2] if b[0] == 'C' else rand_seq(b[1])
        seg[sid] = [sq, 1]
        walk.append((sid, '+'))
        if b[0] == 'C':
            truth_nodes[b[1]] = sid
for f in ('IS26', 'IS10', 'IS1'):
    truth_nodes[f] = fam_id[f]

# The chromosome is circular, but a short-read graph is rarely whole: low-coverage
# gaps leave it in a few pieces, which is also what keeps path enumeration bounded.
gaps = set(rng.sample([i for i, (sid, _) in enumerate(walk) if seg[sid][1] == 1 and sid not in truth_nodes.values()], 6))
for i, (a, ao) in enumerate(walk):
    if i in gaps:
        continue
    b, bo = walk[(i + 1) % len(walk)]
    links.add((a, ao, b, bo))

# SNP bubbles: split unique contigs into left, two alleles, right
uniq = [s for s, (sq, n) in seg.items() if n == 1 and len(sq) > 3000 and s not in truth_nodes.values()]
for sid in rng.sample(uniq, 30):
    sq = seg[sid][0]
    cut = rng.randint(800, len(sq) - 800)
    left, allele, right = sq[:cut], sq[cut:cut + 120], sq[cut + 120:]
    alt = allele[:60] + ('A' if allele[60] != 'A' else 'G') + allele[61:]
    lid, rid, v1, v2 = (str(next(ids)) for _ in range(4))
    seg[lid], seg[rid], seg[v1], seg[v2] = [left, 1], [right, 1], [allele, 0.5], [alt, 0.5]
    del seg[sid]
    new = set()
    for (a, ao, b, bo) in links:
        if a == sid: a = rid
        if b == sid: b = lid
        new.add((a, ao, b, bo))
    links = new | {(lid, '+', v1, '+'), (lid, '+', v2, '+'), (v1, '+', rid, '+'), (v2, '+', rid, '+')}

# dead-end tips from sequencing errors
uniq = [s for s, (sq, n) in seg.items() if n == 1 and s not in truth_nodes.values()]
for sid in rng.sample(uniq, 24):
    tid = str(next(ids))
    seg[tid] = [rand_seq(rng.randint(80, 260)), 0.15]
    links.add((sid, '+', tid, '+') if rng.random() < 0.5 else (tid, '+', sid, '+'))

with open(out_gfa, 'w') as f:
    f.write('H\tVN:Z:1.0\n')
    for sid, (sq, n) in seg.items():
        f.write(f'S\t{sid}\t{sq}\tKC:i:{int(30 * n * len(sq))}\n')
    for a, ao, b, bo in sorted(links):
        f.write(f'L\t{a}\t{ao}\t{b}\t{bo}\t0M\n')

json.dump(truth_nodes, open(out_truth, 'w'))
print(len(seg), 'segments,', len(links), 'links,', sum(len(s[0]) for s in seg.values()), 'bp;', truth_nodes)
