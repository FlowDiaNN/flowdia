export const SAMPLES = {
  iir: `# Second-order recursive filter: y(n) = x(n) + a y(n-1) + b y(n-2)
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
  constraint: `# Constraint graph with host node 9 (transcribed from Fig. 6.6; check against the book)
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
};
