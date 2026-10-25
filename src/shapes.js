// Node shapes, in pixels. One layout unit (`at=` coordinates) is one node radius R.

export const R = 20;

export function shapeOf(n) {
  switch (n.type) {
    case 'fork': return { kind: 'circle', r: 6.5 }; // small open circle where a signal splits
    case 'dot': return { kind: 'circle', r: 3 }; // small filled dot where a signal splits
    case 'delay': return { kind: 'rect', hw: 14, hh: 12 }; // boxed D
    case 'in':
    case 'out': return { kind: 'point' }; // just an arrow end with a label
    default: return { kind: 'circle', r: R };
  }
}

// Where the line from `c` toward `p` leaves the shape centered at `c`.
export function boundary(c, shape, p) {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const len = Math.hypot(dx, dy) || 1;
  if (shape.kind === 'point') return { x: c.x, y: c.y };
  if (shape.kind === 'circle') return { x: c.x + (dx / len) * shape.r, y: c.y + (dy / len) * shape.r };
  const t = Math.min(dx ? shape.hw / Math.abs(dx) : Infinity, dy ? shape.hh / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}
