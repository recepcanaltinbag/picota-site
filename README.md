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

Preview locally with `python3 -m http.server` from this folder.
