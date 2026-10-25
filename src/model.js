// Graph = { weights: 'delay' | 'number', nodes: [{id, type, label, time}], edges: [{id, from, to, w}] }
// Delays live on edges as the weight `w`; "D" boxes are only a rendering of w > 0.
// `time` is a node's computation time in unit times (u.t.).

const ID = '[\\w.]+';

export const defaultTime = (type) => (type === 'io' || type === 'host' ? 0 : 1);

function parseWeight(tok) {
  if (tok === undefined) return 0;
  if (/^-?\d+$/.test(tok)) return parseInt(tok, 10);
  const m = tok.match(/^(-?\d*)D$/);
  if (!m) return null;
  if (m[1] === '') return 1;
  if (m[1] === '-') return -1;
  return parseInt(m[1], 10);
}

export function parseGraph(text) {
  const nodes = new Map();
  const edges = [];
  let weights = 'delay';

  const ensure = (id) => {
    if (!nodes.has(id)) nodes.set(id, { id, type: 'node', label: id, time: undefined });
    return nodes.get(id);
  };

  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const at = `Line ${i + 1}`;
    let m;

    if ((m = line.match(/^@weights\s+(delay|number)$/))) {
      weights = m[1];
      return;
    }
    if ((m = line.match(new RegExp(`^(${ID})\\s*->\\s*(${ID})(?:\\s+(\\S+))?$`)))) {
      const w = parseWeight(m[3]);
      if (w === null) throw new Error(`${at}: can't read the weight "${m[3]}". Use a number, D, or 2D.`);
      ensure(m[1]);
      ensure(m[2]);
      edges.push({ id: `e${edges.length}`, from: m[1], to: m[2], w });
      return;
    }
    if ((m = line.match(new RegExp(`^(${ID})\\s*:\\s*(\\w+)(?:\\s+"([^"]*)")?(?:\\s+t=(\\d+(?:\\.\\d+)?))?$`)))) {
      const n = ensure(m[1]);
      n.type = m[2];
      if (m[3] !== undefined) n.label = m[3];
      if (m[4] !== undefined) n.time = parseFloat(m[4]);
      return;
    }
    throw new Error(`${at}: expected "a -> b [weight]" or "id: type [\\"label\\"] [t=time]".`);
  });

  return {
    weights,
    nodes: [...nodes.values()].map((n) => ({ ...n, time: n.time ?? defaultTime(n.type) })),
    edges,
  };
}

export function serializeGraph(g) {
  const out = [`@weights ${g.weights}`, ''];
  for (const n of g.nodes) {
    const parts = [`${n.id}: ${n.type}`];
    if (n.label !== n.id) parts.push(`"${n.label}"`);
    if (n.time !== defaultTime(n.type)) parts.push(`t=${n.time}`);
    if (parts.length > 1 || n.type !== 'node') out.push(parts.join(' '));
  }
  if (out[out.length - 1] !== '') out.push('');
  for (const e of g.edges) {
    let tok = '';
    if (g.weights === 'number') tok = ` ${e.w}`;
    else if (e.w === 1) tok = ' D';
    else if (e.w !== 0) tok = ` ${e.w}D`;
    out.push(`${e.from} -> ${e.to}${tok}`);
  }
  return out.join('\n') + '\n';
}
