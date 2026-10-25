# FlowDia

A minimalist, fast workbench for drawing, navigating and transforming data flow graphs and block diagrams. Aimed at DSP / VLSI architecture work: retiming, unfolding, folding, and constraint-graph solving.

**Live:** https://flowdiann.github.io/flowdia/

## Use it

- Press `/` (or Ctrl/Cmd+K) to search for a node or run a command.
- `retime 3=-1 5=1`, `unfold 4`, `solve 9`, `load` (pick an example), `undo`, `redo`, `fit`, `export`.
- The bar at the bottom shows each loop's bound (loop time / loop delays) and the iteration bound, which is the largest loop bound. Hover one to highlight that loop, or the critical loops, on the canvas.
- Press `e` for the text editor. Format:

```
@weights delay        # or: number (for constraint graphs)
5: mul "a" t=2        # id: type "label" t=time   (types: node, add, mul, io, host)
IN -> 1
2 -> 3 D              # weight: 0 (omitted), D, 2D, or a plain number
```

## Develop

```
npm install
npm run dev
```

Every transformation is a pure `Graph -> Graph` function in `src/transforms.js`. Layout uses [ELK](https://github.com/kieler/elkjs).

## Roadmap

Folding with schedule labels, cut-set retiming, high-level synthesis, dependency-vector plots, shareable versions.
