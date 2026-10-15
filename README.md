# picota-site

Interactive walkthrough of [PICOTA](https://github.com/recepcanaltinbag/picota), served with GitHub Pages.
Static HTML/CSS/JS with D3 from a CDN; there is no build step.

`data/nitro.json` holds the graph, the DFS event order and the detected cycles for the bundled
`testNitro.gfa`, produced by PICOTA's own `cycle_analysis`:

    python3 tools/export_nitro.py /path/to/picota /path/to/outdir

`data/benchmark.json` holds what the site shows from Supplementary Data 1 (the simulated benchmark):
the summary tables only. It is made with

    python3 tools/export_benchmark.py Supplementary_Data_1_simulated_benchmark.xlsx data/benchmark.json

The spreadsheet itself is not part of this repository.

The cycle scores, gene hits and ORFs come from `picota scoring` on those cycles (run with
`threshold_final_score: 0` so every cycle is scored), merged in with

    python3 tools/export_scores.py data/nitro.json <scoring output> <Pico_Temp/Prodigal_Out/sample>

That run used CARD protein homolog models, the ISfinder/TnCentral IS set and the known composite
transposons; the xenobiotic set was the curated one only.

`data/demo.gfa` is a synthetic graph built the way an assembly graph comes out of a genome with
repeats (real IS and CARD sequences, not an assembly), with two composite transposons planted in it.
It is made, run through PICOTA (detection, then scoring with `threshold_final_score: 0`) and
finished with

    python3 tools/make_demo_gfa.py picota_IS_db.fasta card.json data/demo.gfa tools/demo_truth.json
    python3 tools/export_nitro.py /path/to/picota <outdir> data/demo.gfa demo.json
    python3 tools/export_scores.py demo.json <scoring output> <Prodigal_Out/sample> 0
    python3 tools/finish_demo.py demo.json tools/demo_truth.json card.json

Preview locally with `python3 -m http.server` from this folder.
