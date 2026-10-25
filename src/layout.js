import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();
export const R = 20; // node radius

export async function layoutGraph(g) {
  const orthogonal = g.weights === 'delay';
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
    children: g.nodes.map((n) => ({ id: n.id, width: 2 * R, height: 2 * R })),
    edges: g.edges.map((e) => ({ id: `~${e.id}`, sources: [e.from], targets: [e.to] })),
  };

  const out = await elk.layout(root);

  const nodes = {};
  for (const c of out.children) nodes[c.id] = { x: c.x + R, y: c.y + R };

  const edges = {};
  for (const e of out.edges) {
    const id = e.id.slice(1);
    const src = g.edges.find((x) => x.id === id);
    const sec = e.sections?.[0];
    let pts;
    if (sec) {
      pts = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint].map((p) => ({ x: p.x, y: p.y }));
      pts = clipEnd(pts, nodes[src.from], true);
      pts = clipEnd(pts, nodes[src.to], false);
    } else {
      const c = nodes[src.from];
      pts = src.from === src.to
        ? [{ x: c.x - 8, y: c.y - R }, { x: c.x - 8, y: c.y - R - 26 }, { x: c.x + 8, y: c.y - R - 26 }, { x: c.x + 8, y: c.y - R }]
        : [nodes[src.from], nodes[src.to]];
    }
    edges[id] = pts;
  }

  return { nodes, edges, width: out.width, height: out.height };
}

// Move the first/last point of a route onto the node's circle.
function clipEnd(pts, c, atStart) {
  if (pts.length < 2) return pts;
  const from = atStart ? pts[1] : pts[pts.length - 2];
  const to = atStart ? pts[0] : pts[pts.length - 1];
  const dx = to.x - from.x, dy = to.y - from.y;
  const fx = from.x - c.x, fy = from.y - c.y;
  const a = dx * dx + dy * dy;
  if (a === 0) return pts;
  const b = 2 * (dx * fx + dy * fy);
  const cc = fx * fx + fy * fy - R * R;
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

export function roundedPath(points, r = 10) {
  const pts = points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > 0.01);
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1];
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
