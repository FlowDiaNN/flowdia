// Loop bound of a loop = (sum of node times in the loop) / (sum of delays in the loop).
// Iteration bound = the largest loop bound.

const MAX_LOOPS = 5000;
const MAX_STEPS = 2_000_000;

// Strongly connected components (Tarjan). Loops only exist inside one component.
function components(N, out, idx) {
  const index = new Array(N).fill(-1);
  const low = new Array(N).fill(0);
  const on = new Array(N).fill(false);
  const comp = new Array(N).fill(-1);
  const stack = [];
  let counter = 0;
  let c = 0;

  const visit = (v) => {
    index[v] = low[v] = counter++;
    stack.push(v);
    on[v] = true;
    for (const e of out[v]) {
      const u = idx.get(e.to);
      if (index[u] === -1) {
        visit(u);
        low[v] = Math.min(low[v], low[u]);
      } else if (on[u]) {
        low[v] = Math.min(low[v], index[u]);
      }
    }
    if (low[v] === index[v]) {
      let u;
      do {
        u = stack.pop();
        on[u] = false;
        comp[u] = c;
      } while (u !== v);
      c++;
    }
  };

  for (let v = 0; v < N; v++) if (index[v] === -1) visit(v);
  return comp;
}

export function analyzeLoops(g) {
  const N = g.nodes.length;
  const idx = new Map(g.nodes.map((n, i) => [n.id, i]));
  const out = g.nodes.map(() => []);
  for (const e of g.edges) out[idx.get(e.from)].push(e);
  const comp = components(N, out, idx);

  const loops = [];
  let capped = false;
  let steps = 0;
  const onPath = new Array(N).fill(false);
  const path = [];

  const record = (edges) => {
    let T = 0;
    let W = 0;
    for (const e of edges) {
      T += g.nodes[idx.get(e.from)].time;
      W += e.w;
    }
    const invalid = W <= 0;
    loops.push({
      nodes: edges.map((e) => e.from),
      edges: edges.map((e) => e.id),
      T,
      W,
      invalid,
      ratio: invalid ? Infinity : T / W,
    });
  };

  // Every loop is found once, starting from its lowest-numbered node s.
  const walk = (s, v) => {
    for (const e of out[v]) {
      if (capped) return;
      if (++steps > MAX_STEPS) {
        capped = true;
        return;
      }
      const u = idx.get(e.to);
      if (u < s || comp[u] !== comp[s]) continue;
      if (u === s) {
        record([...path, e]);
        if (loops.length >= MAX_LOOPS) {
          capped = true;
          return;
        }
      } else if (!onPath[u]) {
        onPath[u] = true;
        path.push(e);
        walk(s, u);
        path.pop();
        onPath[u] = false;
      }
    }
  };

  for (let s = 0; s < N && !capped; s++) {
    onPath[s] = true;
    walk(s, s);
    onPath[s] = false;
  }

  loops.sort((a, b) => (a.ratio === b.ratio ? 0 : a.ratio < b.ratio ? 1 : -1));
  const bound = loops.length ? loops[0].ratio : null;
  for (const l of loops) {
    l.critical = bound !== null && (l.ratio === bound || Math.abs(l.ratio - bound) < 1e-9);
  }
  return { loops, critical: loops.filter((l) => l.critical), bound, capped };
}

export const fmt = (x) => (Number.isInteger(x) ? String(x) : String(+x.toFixed(2)));
export const loopLabel = (l) => `${fmt(l.T)}/${fmt(l.W)}`;
export const pathText = (l) => [...l.nodes, l.nodes[0]].join(' → ');

export function boundText(a) {
  if (!a.loops.length) return '';
  if (!Number.isFinite(a.bound)) return 'none (a loop has no delay)';
  const c = a.critical[0];
  const value = Number.isInteger(a.bound) ? fmt(a.bound) : `${loopLabel(c)} ≈ ${fmt(a.bound)}`;
  return `${a.capped ? 'at least ' : ''}${value} u.t.`;
}
