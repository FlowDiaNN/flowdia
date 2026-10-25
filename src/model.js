// Graph = {
//   weights: 'delay' | 'number',
//   delays:  'box' | 'text',            how a delay on an edge is drawn: boxed D, or plain D beside the line
//   nodes: [{ id, type, label, time, at?: [x, y], tl?: 'left' | ... }],
//   edges: [{ id, from, to, w, via?, route?: 'hv' | 'vh', bend?, lp?, ls? }],
//   bend curves an edge, lp is where its weight sits along it (0..1), ls which side (left, right, above, below).
// }
//
// Delays live on edges as the weight `w`. The drawing may also contain structural nodes
// (fork, dot, delay) the way textbooks draw shared delay chains. `semantic()` collapses them
// back into a plain graph, which is what loop bounds and transformations work on.

const ID = '[\\w.]+';
const TL = ['left', 'right', 'above', 'below', 'nw', 'ne', 'sw', 'se'];
const NO_TIME = new Set(['io', 'host', 'in', 'out', 'fork', 'dot', 'delay']);
const STRUCTURAL = new Set(['fork', 'dot', 'delay']);

export const defaultTime = (type) => (NO_TIME.has(type) ? 0 : 1);
export const isStructural = (n) => STRUCTURAL.has(n.type);

function parseWeight(tok) {
  if (tok === undefined) return 0;
  if (/^-?\d+$/.test(tok)) return parseInt(tok, 10);
  const m = tok.match(/^(-?\d*)D$/);
  if (!m) return null;
  if (m[1] === '') return 1;
  if (m[1] === '-') return -1;
  return parseInt(m[1], 10);
}

// "label" and key=value tokens after the first part of a line.
const KV = /\s*(?:"([^"]*)"|([a-z]+)=(\S+))/y;

function props(rest, at) {
  const out = {};
  const s = rest.trim();
  let i = 0;
  while (i < s.length) {
    KV.lastIndex = i;
    const m = KV.exec(s);
    if (!m) throw new Error(`${at}: can't read "${s.slice(i).trim()}".`);
    if (m[1] !== undefined) out.label = m[1];
    else out[m[2]] = m[3];
    i = KV.lastIndex;
  }
  return out;
}

function pair(s, at, key) {
  const m = s.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) throw new Error(`${at}: ${key} needs two numbers, like ${key}=3,1.5.`);
  return [parseFloat(m[1]), parseFloat(m[2])];
}

function only(p, allowed, at) {
  for (const k of Object.keys(p)) {
    if (!allowed.includes(k)) throw new Error(`${at}: unknown option "${k}". Use ${allowed.join(', ')}.`);
  }
}

export function parseGraph(text) {
  const nodes = new Map();
  const edges = [];
  let weights = 'delay';
  let delays = 'box';

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
    if ((m = line.match(/^@delays\s+(box|text)$/))) {
      delays = m[1];
      return;
    }
    if ((m = line.match(new RegExp(`^(${ID})\\s*->\\s*(${ID})(?:\\s+(.*))?$`)))) {
      let rest = m[3] || '';
      let tok;
      if (rest && !/^[a-z]+=/.test(rest)) {
        const sp = rest.search(/\s/);
        tok = sp < 0 ? rest : rest.slice(0, sp);
        rest = sp < 0 ? '' : rest.slice(sp);
      }
      const w = parseWeight(tok);
      if (w === null) throw new Error(`${at}: can't read the weight "${tok}". Use a number, D, or 2D.`);
      const p = props(rest, at);
      only(p, ['via', 'route', 'bend', 'lp', 'ls'], at);
      const edge = { id: `e${edges.length}`, from: m[1], to: m[2], w };
      if (p.via !== undefined) edge.via = p.via.split(';').map((s) => pair(s, at, 'via'));
      if (p.route !== undefined) {
        if (p.route !== 'hv' && p.route !== 'vh') throw new Error(`${at}: route must be hv or vh.`);
        edge.route = p.route;
      }
      if (p.bend !== undefined) {
        const v = parseFloat(p.bend);
        if (!Number.isFinite(v)) throw new Error(`${at}: bend needs a number, like bend=0.4.`);
        edge.bend = v;
      }
      if (p.lp !== undefined) {
        const v = parseFloat(p.lp);
        if (!(v >= 0 && v <= 1)) throw new Error(`${at}: lp must be between 0 and 1.`);
        edge.lp = v;
      }
      if (p.ls !== undefined) {
        if (!['left', 'right', 'above', 'below'].includes(p.ls)) throw new Error(`${at}: ls must be left, right, above or below.`);
        edge.ls = p.ls;
      }
      ensure(m[1]);
      ensure(m[2]);
      edges.push(edge);
      return;
    }
    if ((m = line.match(new RegExp(`^(${ID})\\s*:\\s*(\\w+)(?:\\s+(.*))?$`)))) {
      const p = props(m[3] || '', at);
      only(p, ['label', 't', 'at', 'tl'], at);
      const n = ensure(m[1]);
      n.type = m[2];
      if (p.label !== undefined) n.label = p.label;
      if (p.t !== undefined) {
        const t = parseFloat(p.t);
        if (!Number.isFinite(t)) throw new Error(`${at}: t needs a number, like t=2.`);
        n.time = t;
      }
      if (p.at !== undefined) n.at = pair(p.at, at, 'at');
      if (p.tl !== undefined) {
        if (!TL.includes(p.tl)) throw new Error(`${at}: tl must be one of ${TL.join(', ')}.`);
        n.tl = p.tl;
      }
      return;
    }
    throw new Error(`${at}: expected "a -> b [weight]" or "id: type [\\"label\\"] [t=time] [at=x,y]".`);
  });

  return {
    weights,
    delays,
    nodes: [...nodes.values()].map((n) => ({ ...n, time: n.time ?? defaultTime(n.type) })),
    edges,
  };
}

const num = (x) => String(+x.toFixed(3));

export function serializeGraph(g) {
  const out = [`@weights ${g.weights}`];
  if (g.delays === 'text') out.push('@delays text');
  out.push('');

  for (const n of g.nodes) {
    const parts = [`${n.id}: ${n.type}`];
    if (n.label !== n.id) parts.push(`"${n.label}"`);
    if (n.time !== defaultTime(n.type)) parts.push(`t=${num(n.time)}`);
    if (n.at) parts.push(`at=${num(n.at[0])},${num(n.at[1])}`);
    if (n.tl) parts.push(`tl=${n.tl}`);
    if (parts.length > 1 || n.type !== 'node') out.push(parts.join(' '));
  }
  if (out[out.length - 1] !== '') out.push('');

  for (const e of g.edges) {
    let tok = '';
    if (g.weights === 'number') tok = ` ${e.w}`;
    else if (e.w === 1) tok = ' D';
    else if (e.w !== 0) tok = ` ${e.w}D`;
    if (e.via) tok += ` via=${e.via.map(([x, y]) => `${num(x)},${num(y)}`).join(';')}`;
    if (e.route) tok += ` route=${e.route}`;
    if (e.bend) tok += ` bend=${num(e.bend)}`;
    if (e.lp !== undefined) tok += ` lp=${num(e.lp)}`;
    if (e.ls) tok += ` ls=${e.ls}`;
    out.push(`${e.from} -> ${e.to}${tok}`);
  }
  return out.join('\n') + '\n';
}

// The plain graph behind a drawing: structural nodes are folded into edge weights, layout hints
// are dropped, and each edge remembers which drawn nodes and edges it passes through.
export function semantic(g) {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const outs = new Map(g.nodes.map((n) => [n.id, []]));
  for (const e of g.edges) outs.get(e.from)?.push(e);

  const nodes = g.nodes
    .filter((n) => !isStructural(n))
    .map(({ at, tl, ...n }) => ({ ...n, type: n.type === 'in' || n.type === 'out' ? 'io' : n.type }));

  const edges = [];
  const walk = (src, e, w, ns, es) => {
    const t = byId.get(e.to);
    if (!t) return;
    if (!isStructural(t)) {
      edges.push({ id: `e${edges.length}`, from: src, to: t.id, w, drawn: { nodes: ns, edges: es } });
      return;
    }
    if (ns.includes(t.id)) return; // a loop made only of structural nodes
    const base = w + (t.type === 'delay' ? 1 : 0);
    for (const e2 of outs.get(t.id)) walk(src, e2, base + e2.w, [...ns, t.id], [...es, e2.id]);
  };
  for (const e of g.edges) {
    const from = byId.get(e.from);
    if (from && !isStructural(from)) walk(e.from, e, e.w, [], [e.id]);
  }

  return { weights: g.weights, delays: g.delays, nodes, edges };
}
