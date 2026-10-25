// Examples for the `load` menu.
// In `at=x,y`, one unit is one node radius. `t=` is a node's computation time in u.t.
// The textbook figures are drawn with hand-placed nodes so they look like the book.

export const SAMPLES = {
  loops: {
    title: 'Three loops and the iteration bound',
    source: 'Fig. 2.2',
    text: `# Loop bounds 4/2, 5/3 and 5/4 u.t. Iteration bound = 2 u.t.
# The delays d1..d4 form one shared chain; the dots tap it for nodes 4, 5 and 6.
@weights delay

1: node t=1 at=0,0 tl=left
2: node t=1 at=0,5.5 tl=left
3: node t=1 at=0,8.5 tl=left
4: node t=2 at=6,5.5 tl=nw
5: node t=2 at=6,8.5 tl=nw
6: node t=2 at=6,11.5 tl=nw

d1: delay "d_1" at=9,1.75
d2: delay "d_2" at=9,4
p4: dot at=9,5.5
d3: delay "d_3" at=9,7
p5: dot at=9,8.5
d4: delay "d_4" at=9,10

1 -> d1
d1 -> d2
d2 -> p4
p4 -> d3
p4 -> 4
d3 -> p5
p5 -> d4
p5 -> 5
d4 -> 6 route=vh
4 -> 2
5 -> 3
6 -> 3
3 -> 2
2 -> 1
`,
  },
  'fir-direct': {
    title: 'Direct-form 3-tap FIR filter',
    source: 'Fig. 1.24(a)',
    text: `# y(n) = b0 x(n) + b1 x(n-1) + b2 x(n-2)
@weights delay
@delays text

x: in "x(n)" at=-2.2,0
y: out "y(n)" at=19.5,7.5
f0: fork at=0,0
f1: fork at=7,0
b0: node "b_0" t=4 at=0,3.5 tl=right
b1: node "b_1" t=4 at=7,3.5 tl=right
b2: node "b_2" t=4 at=15,3.5 tl=right
A0: node t=2 at=7,7.5 tl=se
A1: node t=2 at=15,7.5 tl=se

x -> f0
f0 -> b0
f0 -> f1 D
f1 -> b1
f1 -> b2 D
b0 -> A0 route=vh
b1 -> A0
A0 -> A1
b2 -> A1
A1 -> y
`,
  },
  'fir-transposed': {
    title: 'Transposed 3-tap FIR filter',
    source: 'Fig. 1.24(b)',
    text: `# Same filter with the delays moved onto the adder chain
@weights delay
@delays text

x: in "x(n)" at=-2.2,0
y: out "y(n)" at=19.5,7.5
f0: fork at=0,0
f1: fork at=7,0
b2: node "b_2" t=4 at=0,3.5 tl=right
b1: node "b_1" t=4 at=7,3.5 tl=right
b0: node "b_0" t=4 at=15,3.5 tl=right
A1: node t=2 at=7,7.5 tl=se
A0: node t=2 at=15,7.5 tl=se

x -> f0
f0 -> b2
f0 -> f1
f1 -> b1
f1 -> b0
b2 -> A1 D route=vh
b1 -> A1
A1 -> A0 D
b0 -> A0
A0 -> y
`,
  },
  iir: {
    title: 'Second-order recursive filter',
    source: '',
    text: `# y(n) = x(n) + a y(n-1) + b y(n-2)
@weights delay

IN: io
OUT: io
1: add
2: add
3: mul "a"
4: mul "b"

IN -> 1
1 -> 2
2 -> OUT
2 -> 3 D
2 -> 4 2D
3 -> 1
4 -> 2
`,
  },
  constraint: {
    title: 'Constraint graph with host node 9',
    source: 'Fig. 6.6',
    text: `# Hand-placed from the book. The big arcs are 9 -> 8, 9 -> 1, 9 -> 4, 9 -> 5, 1 -> 3 and 3 -> 5.
# bend= curves an edge, lp= is where its weight sits along it, ls= which side of the line.
@weights number

9: host at=0,0
1: node at=-1,18.1
2: node at=1.8,12.6
3: node at=9,7.4
4: node at=16.2,11.2
5: node at=19.1,16.2
6: node at=16.2,22.4
7: node at=9.5,25.7
8: node at=2.5,23.9

9 -> 8 0 bend=-0.54 lp=0.14 ls=left
9 -> 1 0 bend=-0.38 lp=0.14 ls=left
9 -> 2 0 lp=0.4 ls=right
9 -> 7 0 lp=0.38 ls=right
9 -> 6 0 lp=0.3
9 -> 3 0 lp=0.45
9 -> 4 0 bend=0.35 lp=0.4
9 -> 5 0 bend=0.7 lp=0.25
1 -> 3 0 bend=0.82 lp=0.38
2 -> 1 -1 lp=0.4
2 -> 4 0 lp=0.75
3 -> 5 0 bend=0.84 lp=0.4
3 -> 7 -1 lp=0.5
4 -> 6 -1 lp=0.65
4 -> 8 -1 lp=0.25
5 -> 1 0 lp=0.84
6 -> 1 0 lp=0.7
7 -> 1 1 lp=0.2
8 -> 1 1 lp=0.35 ls=right
`,
  },
};
