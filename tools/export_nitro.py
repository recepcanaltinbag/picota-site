import sys, json, re
# usage: export_nitro.py picota_repo out_dir [graph.gfa] [name.json]
repo = sys.argv[1]; out = sys.argv[2]
sys.path.insert(0, repo + '/picota')
import src.cycle_finderv2 as cf
cap = {}
orig_filter = cf.filter_cycles_with_kmer
def f(lst, *a, **k):
    cap['before_kmer'] = len(lst)
    r = orig_filter(lst, *a, **k); cap['final'] = r; return r
cf.filter_cycles_with_kmer = f
orig_dfs = cf.GraphWork.dfs_iterative
def d(self, G):
    r = orig_dfs(self, G); cap['gw'] = self; return r
cf.GraphWork.dfs_iterative = d
gfa = sys.argv[3] if len(sys.argv) > 3 else repo + '/picota/test_data/testNitro.gfa'
name = sys.argv[4] if len(sys.argv) > 4 else 'nitro.json'
import io, contextlib
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    cf.cycle_analysis(gfa, out + '/cycles.fasta', True, 25, 1000, 40000, 'Cycle', 1, 25, 80, 80)
gw = cap['gw']
segs, links = [], []
for line in open(gfa):
    p = line.rstrip('\n').split('\t')
    if p[0] == 'S':
        kc = re.search(r'KC:i:(\d+)', line); ln = len(p[2])
        segs.append({'id': p[1], 'len': ln, 'depth': round(int(kc.group(1))/max(ln,1),1) if kc else None})
    elif p[0] == 'L':
        links.append([p[1], p[2], p[3], p[4]])
cycles = [{'name': c.name, 'len': c.length, 'comp': c.component_number, 'path': list(c.path),
           'rev': bool(getattr(c, 'reverseOriented', False))} for c in cap['final']]
stats = {'segments': len(segs), 'links': len(links), 'back_edges': len(gw.cycles),
         'reverse_back_edges': len(gw.reverse_or_cycles), 'all_paths': len(gw.allPaths),
         'reverse_paths': len(gw.reverseallPaths), 'before_kmer': cap['before_kmer'], 'final': len(cycles)}
json.dump({'segments': segs, 'links': links, 'cycles': cycles, 'stats': stats}, open(out + '/' + name, 'w'))
print(json.dumps(stats)); [print(c['name'], c['len'], c['comp'], c['rev'], c['path']) for c in cycles]

# Replay the DFS with the same neighbour order, recording events for the animation
G = cf.GraphWork().generate_genome_graph(*cf.GraphWork().parse_gfa(gfa))
ev = []; discovered = set(); finished = set()
for s in G.adj.copy():
    if s in discovered: continue
    stack = [(s, iter(G.adj[s]))]
    while stack:
        cur, nb = stack[-1]
        if cur not in discovered:
            discovered.add(cur); ev.append(['d', cur])
        try:
            n = next(nb)
            if n in discovered: ev.append(['b', cur, n]); continue
            flip = n.replace('-', '+') if n.endswith('-') else n.replace('+', '-')
            if flip in discovered: ev.append(['r', cur, n]); continue
            if n not in finished: stack.append((n, iter(G.adj[n])))
        except StopIteration:
            stack.pop(); discovered.remove(cur); finished.add(cur); ev.append(['f', cur])
data = json.load(open(out + '/' + name)); data['dfs'] = ev
json.dump(data, open(out + '/' + name, 'w'), separators=(',', ':'))
print('events', len(ev), sum(e[0]=='b' for e in ev), sum(e[0]=='r' for e in ev))
