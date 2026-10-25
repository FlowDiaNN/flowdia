import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import 'd3-transition';
import { roundedPath, midpoint, longestSegment, edgeLabelSpot } from './layout.js';
import { R, shapeOf } from './shapes.js';
import { defaultTime, isStructural } from './model.js';
import { fmt } from './analysis.js';
import { THEME as T } from './theme.js';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Where a "(time)" label sits beside its node: [dx, dy] in node radii, and text anchor.
const TIME_AT = {
  left: [-1.25, 0, 'end'],
  right: [1.4, 0, 'start'],
  above: [0, -1.55, 'middle'],
  below: [0, 1.55, 'middle'],
  nw: [-1.0, -0.7, 'end'],
  ne: [0.85, -1.05, 'start'],
  sw: [-0.9, 1.25, 'end'],
  se: [0.9, 1.25, 'start'],
};

// Bigger glyphs for short labels, like the textbook figures.
function labelSize(label) {
  const m = label.match(/^(.+)_([^_]+)$/);
  const glyphs = m ? m[1].length + 0.7 * m[2].length : label.length;
  return glyphs <= 1.2 ? 1.3 * R : glyphs <= 2.4 ? 0.95 * R : glyphs <= 3.4 ? 0.8 * R : 0.65 * R;
}

function Label({ text, x, y, size = 15, fill = T.ink, italic = false, anchor = 'middle' }) {
  const m = text.match(/^(.+)_([^_]+)$/);
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fontFamily={T.serif}
      fontSize={size} fontStyle={italic ? 'italic' : 'normal'} fill={fill} style={{ pointerEvents: 'none' }}>
      {m ? (<><tspan>{m[1]}</tspan><tspan dy={size * 0.25} fontSize={size * 0.68}>{m[2]}</tspan></>) : text}
    </text>
  );
}

function Markers() {
  const mk = (id, color) => (
    <marker key={id} id={id} viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="8.5" markerHeight="8.5" markerUnits="userSpaceOnUse" orient="auto">
      <path d="M0,1.6 L9.5,5 L0,8.4 z" fill={color} />
    </marker>
  );
  return <defs>{[mk('arrow-line', T.line), mk('arrow-accent', T.accent), mk('arrow-alert', T.alert)]}</defs>;
}

// hl = { nodes: Set, edges: Set } of loop parts to highlight; everything else fades.
const GraphView = forwardRef(function GraphView({ graph, layout, selected, marks, solution, hl, onSelect }, ref) {
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);

  useEffect(() => {
    const svg = select(svgRef.current);
    const z = zoom()
      .scaleExtent([0.15, 6])
      .on('zoom', (ev) => gRef.current?.setAttribute('transform', ev.transform.toString()));
    zoomRef.current = z;
    svg.call(z).on('dblclick.zoom', null);
    return () => { svg.on('.zoom', null); };
  }, []);

  const fit = () => {
    if (!layout || !svgRef.current) return;
    const { width, height } = svgRef.current.getBoundingClientRect();
    const top = 96; // room for the command bar
    const bottom = 44; // room for the status bar
    const k = Math.min(width / layout.width, (height - top - bottom) / layout.height, 2);
    const tx = (width - layout.width * k) / 2;
    const ty = top + (height - top - bottom - layout.height * k) / 2;
    const t = zoomIdentity.translate(tx, ty).scale(k);
    const sel = select(svgRef.current);
    (reduceMotion() ? sel : sel.transition().duration(300)).call(zoomRef.current.transform, t);
  };

  useEffect(fit, [layout]);

  useImperativeHandle(ref, () => ({
    fit,
    exportSvg() {
      const clone = svgRef.current.cloneNode(true);
      clone.querySelector('g.viewport').removeAttribute('transform');
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
      clone.setAttribute('width', layout.width);
      clone.setAttribute('height', layout.height);
      const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'graph.svg';
      a.click();
      URL.revokeObjectURL(a.href);
    },
  }));

  const delayMode = graph.weights === 'delay';
  const textDelays = graph.delays === 'text';
  const active = marks && marks.size > 0;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const showTimes = delayMode && graph.nodes.some((n) => n.tl || (n.time !== defaultTime(n.type)));

  return (
    <svg ref={svgRef} className="canvas" onClick={() => onSelect(null)} role="img" aria-label="Graph canvas">
      <Markers />
      <g ref={gRef} className="viewport">
        {graph.edges.map((e) => {
          const pts = layout.edges[e.id];
          if (!pts) return null;
          const ctrl = layout.curves?.[e.id];
          const hot = !!hl && hl.edges.has(e.id);
          const incident = !hl && selected && (e.from === selected || e.to === selected);
          const invalid = delayMode && e.w < 0;
          const dim = hl ? !hot : (active && !marks.has(e.from) && !marks.has(e.to)) || (selected && !incident);
          const tone = hot || incident ? T.accent : invalid ? T.alert : T.line;
          const arrow = byId.get(e.to)?.type !== 'dot'; // a line meeting a dot has no arrowhead
          const marker = hot || incident ? 'arrow-accent' : invalid ? 'arrow-alert' : 'arrow-line';
          const text = delayMode ? (e.w === 1 ? 'D' : `${e.w}D`) : String(e.w);
          const boxW = 24 + (text.length - 1) * 8;
          const boxTone = hot ? T.accent : invalid ? T.alert : T.ink;

          let weight = null;
          if (delayMode && e.w !== 0) {
            if (textDelays) {
              // Plain D beside the longest straight piece of the line.
              const [a, b] = longestSegment(pts);
              const flat = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
              const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              weight = flat
                ? <Label text={text} x={m.x} y={m.y - 11} size={16} fill={boxTone} />
                : <Label text={text} x={m.x + 9} y={m.y} size={16} fill={boxTone} anchor="start" />;
            } else {
              const mid = midpoint(pts);
              weight = (
                <>
                  <rect x={mid.x - boxW / 2} y={mid.y - 12} width={boxW} height={24} fill={T.paper} stroke={boxTone} strokeWidth={hot ? 2 : 1.2} />
                  <Label text={text} x={mid.x} y={mid.y} size={14} fill={boxTone} />
                </>
              );
            }
          } else if (!delayMode) {
            const s = edgeLabelSpot(pts, ctrl, e);
            weight = (
              <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="central" fontFamily={T.serif} fontSize={0.8 * R}
                fill={hot || incident ? T.accent : T.ink} stroke={T.paper} strokeWidth="4" paintOrder="stroke">
                {text}
              </text>
            );
          }

          return (
            <g key={e.id} opacity={dim ? 0.18 : 1}>
              <path d={ctrl ? `M${pts[0].x},${pts[0].y}Q${ctrl.x},${ctrl.y} ${pts[1].x},${pts[1].y}` : roundedPath(pts)} fill="none" stroke={tone} strokeWidth={hot ? 2.4 : incident ? 1.8 : 1.2}
                markerEnd={arrow ? `url(#${marker})` : undefined} />
              {weight}
            </g>
          );
        })}

        {graph.nodes.map((n) => {
          const p = layout.nodes[n.id];
          if (!p) return null;
          const hot = !!hl && hl.nodes.has(n.id);
          const isSel = selected === n.id;
          const hit = !active || marks.has(n.id);
          const dim = hl
            ? !hot
            : (active && !hit) || (selected && !isSel && !graph.edges.some((e) => (e.from === selected && e.to === n.id) || (e.to === selected && e.from === n.id)));
          const stroke = hot || isSel || (active && hit) ? T.accent : T.ink;
          const sw = hot || isSel ? 2.2 : 1.2;

          // Structural pieces: forks, dots, delay boxes and the arrow ends of a drawing.
          if (isStructural(n) || n.type === 'in' || n.type === 'out') {
            let body = null;
            if (n.type === 'fork') body = <circle cx={p.x} cy={p.y} r={shapeOf(n).r} fill={T.paper} stroke={stroke} strokeWidth={sw} />;
            else if (n.type === 'dot') body = <circle cx={p.x} cy={p.y} r={shapeOf(n).r} fill={hot ? T.accent : T.ink} />;
            else if (n.type === 'delay') {
              const s = shapeOf(n);
              body = (
                <>
                  <rect x={p.x - s.hw} y={p.y - s.hh} width={2 * s.hw} height={2 * s.hh} fill={T.paper} stroke={stroke} strokeWidth={sw} />
                  <Label text="D" x={p.x} y={p.y} size={16} fill={hot ? T.accent : T.ink} />
                  {n.label !== n.id && <Label text={n.label} x={p.x + s.hw + 8} y={p.y} size={21} anchor="start" />}
                </>
              );
            } else {
              body = n.label !== n.id || n.type
                ? <Label text={n.label} x={p.x} y={p.y - (n.type === 'in' ? 13 : 16)} size={17}
                    anchor={n.type === 'in' ? 'end' : 'start'} />
                : null;
            }
            return <g key={n.id} opacity={dim ? 0.3 : 1} style={{ pointerEvents: 'none' }}>{body}</g>;
          }

          const symbol = n.type === 'add' ? '+' : n.type === 'mul' ? '×' : null;
          const host = n.type === 'host';
          const timed = showTimes && n.type !== 'io' && !host && (n.tl || !!showTimes);
          const [tx, ty, anchor] = TIME_AT[n.tl || 'ne'];
          return (
            <g key={n.id} opacity={dim ? 0.3 : 1} style={{ cursor: 'pointer' }}
              onClick={(ev) => { ev.stopPropagation(); onSelect(n.id); }}>
              <circle cx={p.x} cy={p.y} r={R} fill={T.paper} stroke={stroke}
                strokeWidth={sw} strokeDasharray={n.type === 'io' ? '3 3' : undefined} />
              {symbol
                ? (<>
                    <Label text={symbol} x={p.x} y={p.y} size={1.1 * R} />
                    <Label text={n.label} x={p.x + R * 0.8} y={p.y + R * 0.95} size={13} italic anchor="start" fill={T.line} />
                  </>)
                : <Label text={n.label} x={p.x} y={p.y} size={labelSize(n.label)} />}
              {timed && <Label text={`(${fmt(n.time)})`} x={p.x + tx * R} y={p.y + ty * R} size={0.8 * R} anchor={anchor} />}
              {solution && Number.isFinite(solution[n.id]) && (
                <text x={p.x} y={p.y - R - 8} textAnchor="middle" fontFamily={T.sans} fontSize="12" fill={T.accent}>
                  r = {solution[n.id]}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
});

export default GraphView;
