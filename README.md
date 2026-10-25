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
@delays text          # draw delays as plain D beside the line (default: boxed D)
5: mul "a" t=2        # id: type "label" t=time   (types: node, add, mul, io, host)
IN -> 1
2 -> 3 D              # weight: 0 (omitted), D, 2D, or a plain number
```

### Drawing it like the book

Give every node an `at=x,y` and the graph keeps your layout instead of auto-layout. One unit is one node radius.

```
x: in "x(n)" at=-2.2,0            # in / out: a labeled arrow end
f0: fork at=0,0                   # small open circle where a signal splits
p4: dot at=9,5.5                  # small filled dot (no arrowhead into it)
d1: delay "d_1" at=9,1.75         # boxed D; adds one delay to any path through it
b0: node "b_0" t=4 at=0,3.5 tl=right    # tl: left right above below nw ne sw se
b0 -> A0 route=vh                 # right-angle routes: hv (default) or vh
a -> b via=3,0;3,4                # or give the corners yourself
9 -> 5 0 bend=0.7 lp=0.25 ls=left # curve an edge; where its weight sits (lp) and on which side (ls)
```

Forks, dots and delay boxes fold back into plain edge weights, so loop bounds, retiming and unfolding work on a hand-drawn figure. After a transformation the result is laid out automatically.

The `load` menu has Fig. 2.2 (loop bounds), Fig. 1.24 (direct and transposed FIR) and Fig. 6.6 (constraint graph) drawn this way.

## Develop

```
npm install
npm run dev
```

Every transformation is a pure `Graph -> Graph` function in `src/transforms.js`. Layout uses [ELK](https://github.com/kieler/elkjs).

## Roadmap

Folding with schedule labels, cut-set retiming, high-level synthesis, dependency-vector plots, shareable versions.
