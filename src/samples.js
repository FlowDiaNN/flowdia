// Examples for the `load` menu. `t=` is a node's computation time in u.t.

export const SAMPLES = {
  loops: {
    title: 'Three loops and the iteration bound',
    source: 'Fig. 2.2',
    text: `# Loop bounds 4/2, 5/3 and 5/4 u.t. Iteration bound = 2 u.t.
@weights delay

1: node t=1
2: node t=1
3: node t=1
4: node t=2
5: node t=2
6: node t=2

1 -> 4 2D
1 -> 5 3D
1 -> 6 4D
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

x: io "x(n)"
y: io "y(n)"
b0: node "b_0" t=4
b1: node "b_1" t=4
b2: node "b_2" t=4
A0: node t=2
A1: node t=2

x -> b0
x -> b1 D
x -> b2 2D
b0 -> A0
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

x: io "x(n)"
y: io "y(n)"
b0: node "b_0" t=4
b1: node "b_1" t=4
b2: node "b_2" t=4
A0: node t=2
A1: node t=2

x -> b0
x -> b1
x -> b2
b2 -> A1 D
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
    text: `# Transcribed by eye from the book; check the weights
@weights number

9: host
9 -> 1
9 -> 8
9 -> 2
9 -> 3
9 -> 4
9 -> 5
9 -> 6
9 -> 7
1 -> 3
2 -> 1 -1
2 -> 4
3 -> 5
3 -> 7 -1
4 -> 6 -1
4 -> 8 -1
5 -> 1
6 -> 1
7 -> 1 1
8 -> 1 1
`,
  },
};
