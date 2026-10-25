// Every transformation is a pure function Graph -> Graph.

// Retiming: w_r(U->V) = w(U->V) + r(V) - r(U)
export function retime(g, r) {
  return {
    ...g,
    edges: g.edges.map((e) => ({ ...e, w: e.w + (r[e.to] ?? 0) - (r[e.from] ?? 0) })),
  };
}

// J-unfolding: each node U becomes U_0..U_{J-1};
// edge U->V with w delays becomes U_i -> V_{(i+w) mod J} with floor((i+w)/J) delays.
export function unfold(g, J) {
  const nodes = [];
  for (const n of g.nodes) {
    for (let i = 0; i < J; i++) {
      nodes.push({ ...n, id: `${n.id}_${i}`, label: `${n.label}_${i}` });
    }
  }
  const edges = [];
  for (const e of g.edges) {
    for (let i = 0; i < J; i++) {
      const k = i + e.w;
      edges.push({
        id: `e${edges.length}`,
        from: `${e.from}_${i}`,
        to: `${e.to}_${((k % J) + J) % J}`,
        w: Math.floor(k / J),
      });
    }
  }
  return { ...g, nodes, edges };
}

// Constraint graph: edge u->v with weight w means r(v) - r(u) <= w.
// Bellman-Ford from `source` gives a feasible r, or a negative cycle.
export function bellmanFord(g, source) {
  const dist = Object.fromEntries(g.nodes.map((n) => [n.id, Infinity]));
  const pred = {};
  dist[source] = 0;
  const N = g.nodes.length;
  let last = null;

  for (let pass = 0; pass < N; pass++) {
    last = null;
    for (const e of g.edges) {
      if (dist[e.from] + e.w < dist[e.to]) {
        dist[e.to] = dist[e.from] + e.w;
        pred[e.to] = e.from;
        last = e.to;
      }
    }
    if (last === null) break;
  }

  if (last === null) return { feasible: true, r: dist };

  let x = last;
  for (let i = 0; i < N; i++) x = pred[x];
  const cycle = [x];
  for (let y = pred[x]; y !== x; y = pred[y]) cycle.push(y);
  cycle.reverse();
  return { feasible: false, cycle };
}
