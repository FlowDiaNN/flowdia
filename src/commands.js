export const COMMANDS = [
  { name: 'retime', args: true, desc: 'Move delays across nodes: w + r(v) - r(u). Example: retime 3=-1 5=1' },
  { name: 'unfold', args: true, desc: 'J-unfold the graph. Example: unfold 4' },
  { name: 'solve', args: true, desc: 'Solve a constraint graph from a source node. Example: solve 9' },
  { name: 'load', args: true, desc: 'Open an example: iir or constraint' },
  { name: 'edit', args: false, desc: 'Show or hide the text editor' },
  { name: 'fit', args: false, desc: 'Fit the graph to the window' },
  { name: 'undo', args: false, desc: 'Go back one step' },
  { name: 'redo', args: false, desc: 'Go forward one step' },
  { name: 'export', args: false, desc: 'Download the graph as SVG' },
];
