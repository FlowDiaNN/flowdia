import ELK from 'elkjs/lib/elk.bundled.js';
import { R, shapeOf, boundary } from './shapes.js';

export { R };

const elk = new ELK();

// Hand-placed graphs give every node an `at=x,y`; everything else is laid out by ELK.
const isManual = (g) => g.nodes.length > 0 && g.nodes.every((n) => n.at);

export async function layoutGraph(g) {
  return isManual(g) ? layoutManual(g) : layoutElk(g);
}

const near = (a, b) => Math.abs(a - b) < 0.01;

function selfLoop(c, r) {
  return [{ x: c.x - 8, y: c.y - r }, { x: c.x - 8, y: c.y - r - 26 }, { x: c.x + 8, y: c.y - r - 26 }, { x: c.x + 8, y: c.y - r }];
}

function layoutManual(g) {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const nodes = {};
  for (const n of g.nodes) nodes[n.id] = { x: n.at[0] * R, y: n.at[1] * R };

  const edges = {};
  const curves = {};
  for (const e of g.edges) {
    const a = nodes[e.from];
    const b = nodes[e.to];
    const sa = shapeOf(byId.get(e.from));
    const sb = shapeOf(byId.get(e.to));
    if (e.from === e.to) {
      edges[e.id] = selfLoop(a, sa.r ?? R);
      continue;
    }
    if (e.bend && !e.via?.length) {
      // A gentle arc: a quadratic curve whose control point sits off the middle of the chord.
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const c = {
        x: (a.x + b.x) / 2 + ((b.y - a.y) / L) * e.bend * L,
        y: (a.y + b.y) / 2 - ((b.x - a.x) / L) * e.bend * L,
      };
      edges[e.id] = [boundary(a, sa, c), boundary(b, sb, c)];
      curves[e.id] = c;
      continue;
    }
    const pts = [a, ...(e.via || []).map(([x, y]) => ({ x: x * R, y: y * R })), b];
    // Block diagrams: go straight if aligned, otherwise make one right-angle turn.
    // Constraint graphs draw straight lines unless a route is asked for.
    const elbow = e.route || g.weights === 'delay';
    if (elbow && !e.via?.length && !near(a.x, b.x) && !near(a.y, b.y)) {
      pts.splice(1, 0, e.route === 'vh' ? { x: a.x, y: b.y } : { x: b.x, y: a.y });
    }
    const first = pts[0];
    const last = pts[pts.length - 1];
    pts[0] = boundary(first, sa, pts[1]);
    pts[pts.length - 1] = boundary(last, sb, pts[pts.length - 2]);
    edges[e.id] = pts;
  }

  // Bounding box with room for the labels around each node.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of g.nodes) {
    const c = nodes[n.id];
    const s = shapeOf(n);
    const ex = s.kind === 'point' ? 56 : s.kind === 'rect' ? s.hw + 44 : s.r + 34;
    const ey = s.kind === 'point' ? 28 : s.kind === 'rect' ? s.hh + 24 : s.r + 38;
    x0 = Math.min(x0, c.x - ex);
    x1 = Math.max(x1, c.x + ex);
    y0 = Math.min(y0, c.y - ey);
    y1 = Math.max(y1, c.y + ey);
  }
  for (const pts of Object.values(edges)) {
    for (const p of pts) {
      x0 = Math.min(x0, p.x - 8);
      x1 = Math.max(x1, p.x + 8);
      y0 = Math.min(y0, p.y - 8);
      y1 = Math.max(y1, p.y + 8);
    }
  }
  for (const [id, c] of Object.entries(curves)) {
    const [p, q] = edges[id];
    for (let t = 0.1; t < 1; t += 0.1) {
      const x = (1 - t) * (1 - t) * p.x + 2 * t * (1 - t) * c.x + t * t * q.x;
      const y = (1 - t) * (1 - t) * p.y + 2 * t * (1 - t) * c.y + t * t * q.y;
      x0 = Math.min(x0, x - 20);
      x1 = Math.max(x1, x + 20);
      y0 = Math.min(y0, y - 20);
      y1 = Math.max(y1, y + 20);
    }
  }
  const dx = -x0;
  const dy = -y0;
  for (const c of Object.values(nodes)) { c.x += dx; c.y += dy; }
  for (const pts of Object.values(edges)) for (const p of pts) { p.x += dx; p.y += dy; }
  for (const c of Object.values(curves)) { c.x += dx; c.y += dy; }

  return { nodes, edges, curves, width: x1 - x0, height: y1 - y0, manual: true };
}

async function layoutElk(g) {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const orthogonal = g.weights === 'delay';
  const size = (n) => {
    const s = shapeOf(n);
    return s.kind === 'circle' ? { width: 2 * s.r, height: 2 * s.r }
      : s.kind === 'rect' ? { width: 2 * s.hw, height: 2 * s.hh }
      : { width: 2, height: 2 };
  };

  const root = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': orthogonal ? 'ORTHOGONAL' : 'POLYLINE',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '44',
      'elk.spacing.edgeNode': '24',
      'elk.layered.feedbackEdges': 'true',
      'elk.padding': '[top=40,left=40,bottom=40,right=40]',
    },
    children: g.nodes.map((n) => ({ id: n.id, ...size(n) })),
    edges: g.edges.map((e) => ({ id: `~${e.id}`, sources: [e.from], targets: [e.to] })),
  };

  const out = await elk.layout(root);

  const nodes = {};
  for (const c of out.children) nodes[c.id] = { x: c.x + c.width / 2, y: c.y + c.height / 2 };

  const edges = {};
  for (const e of out.edges) {
    const id = e.id.slice(1);
    const src = g.edges.find((x) => x.id === id);
    const sec = e.sections?.[0];
    let pts;
    if (sec) {
      pts = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint].map((p) => ({ x: p.x, y: p.y }));
      pts = clipEnd(pts, nodes[src.from], shapeOf(byId.get(src.from)), true);
      pts = clipEnd(pts, nodes[src.to], shapeOf(byId.get(src.to)), false);
    } else {
      const c = nodes[src.from];
      pts = src.from === src.to ? selfLoop(c, R) : [nodes[src.from], nodes[src.to]];
    }
    edges[id] = pts;
  }

  return { nodes, edges, width: out.width, height: out.height };
}

// Move the first/last point of a route onto a circle's edge.
function clipEnd(pts, c, shape, atStart) {
  if (shape.kind !== 'circle' || pts.length < 2) return pts;
  const r = shape.r;
  const from = atStart ? pts[1] : pts[pts.length - 2];
  const to = atStart ? pts[0] : pts[pts.length - 1];
  const dx = to.x - from.x, dy = to.y - from.y;
  const fx = from.x - c.x, fy = from.y - c.y;
  const a = dx * dx + dy * dy;
  if (a === 0) return pts;
  const b = 2 * (dx * fx + dy * fy);
  const cc = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return pts;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0 || t > 3) return pts;
  const p = { x: from.x + t * dx, y: from.y + t * dy };
  const next = [...pts];
  next[atStart ? 0 : next.length - 1] = p;
  return next;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// r = 0 gives sharp corners, like the textbook figures.
export function roundedPath(points, r = 0) {
  const pts = points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > 0.01);
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1];
    if (r <= 0) { d += `L${p.x},${p.y}`; continue; }
    const la = dist(a, p), lb = dist(p, b);
    const k = Math.min(r, la / 2, lb / 2);
    d += `L${p.x + ((a.x - p.x) * k) / la},${p.y + ((a.y - p.y) * k) / la}`;
    d += `Q${p.x},${p.y} ${p.x + ((b.x - p.x) * k) / lb},${p.y + ((b.y - p.y) * k) / lb}`;
  }
  const last = pts[pts.length - 1];
  return d + `L${last.x},${last.y}`;
}

export function midpoint(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  let walk = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (walk <= seg && seg > 0) {
      const t = walk / seg;
      return { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y) };
    }
    walk -= seg;
  }
  return pts[0];
}

// The longest straight piece of a route: where a plain "D" label sits.
export function longestSegment(pts) {
  let best = -1;
  let seg = [pts[0], pts[pts.length - 1]];
  for (let i = 1; i < pts.length; i++) {
    const len = dist(pts[i - 1], pts[i]);
    if (len > best) { best = len; seg = [pts[i - 1], pts[i]]; }
  }
  return seg;
}

// Where an edge's weight goes: a point `lp` of the way along the edge, nudged to one side.
const SIDE = { left: [-1, 0], right: [1, 0], above: [0, -1], below: [0, 1] };

export function edgeLabelSpot(pts, ctrl, e, off = 14) {
  const t = e.lp ?? 0.5;
  let p;
  let d;
  if (ctrl) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    p = {
      x: (1 - t) * (1 - t) * a.x + 2 * t * (1 - t) * ctrl.x + t * t * b.x,
      y: (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * ctrl.y + t * t * b.y,
    };
    d = { x: 2 * (1 - t) * (ctrl.x - a.x) + 2 * t * (b.x - ctrl.x), y: 2 * (1 - t) * (ctrl.y - a.y) + 2 * t * (b.y - ctrl.y) };
  } else {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
    let walk = total * t;
    p = pts[0];
    d = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
    for (let i = 1; i < pts.length; i++) {
      const seg = dist(pts[i - 1], pts[i]);
      d = { x: pts[i].x - pts[i - 1].x, y: pts[i].y - pts[i - 1].y };
      if (walk <= seg && seg > 0) {
        const u = walk / seg;
        p = { x: pts[i - 1].x + u * d.x, y: pts[i - 1].y + u * d.y };
        break;
      }
      walk -= seg;
      p = pts[i];
    }
  }
  const len = Math.hypot(d.x, d.y) || 1;
  const n = { x: d.y / len, y: -d.x / len };
  const want = SIDE[e.ls] ?? [-0.5, -1]; // by default, above and to the left
  const sign = n.x * want[0] + n.y * want[1] >= 0 ? 1 : -1;
  return { x: p.x + sign * n.x * off, y: p.y + sign * n.y * off };
}
