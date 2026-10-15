# picota-site

Interactive walkthrough of [PICOTA](https://github.com/recepcanaltinbag/picota), served with GitHub Pages.
Static HTML/CSS/JS with D3 from a CDN; there is no build step.

`data/nitro.json` holds the graph, the DFS event order and the detected cycles for the bundled
`testNitro.gfa`, produced by PICOTA's own `cycle_analysis`:

    python3 tools/export_nitro.py /path/to/picota /path/to/outdir

`data/benchmark.json` holds what the site shows from Supplementary Data 1 (the simulated benchmark):
the summary tables and a 24-element preview without coordinates. It is made with

    python3 tools/export_benchmark.py Supplementary_Data_1_simulated_benchmark.xlsx data/benchmark.json

The spreadsheet itself is not part of this repository.

Preview locally with `python3 -m http.server` from this folder.
