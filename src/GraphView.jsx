import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import 'd3-transition';
import { R, roundedPath, midpoint } from './layout.js';
import { defaultTime } from './model.js';
import { THEME as T } from './theme.js';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
    <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0,1.2 L9,5 L0,8.8 z" fill={color} />
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
      .scaleExtent([0.15, 4])
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
    const k = Math.min(width / layout.width, (height - top - bottom) / layout.height, 1.4);
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
  const active = marks && marks.size > 0;
  const showTimes = delayMode && graph.nodes.some((n) => n.time !== defaultTime(n.type));

  return (
    <svg ref={svgRef} className="canvas" onClick={() => onSelect(null)} role="img" aria-label="Graph canvas">
      <Markers />
      <g ref={gRef} className="viewport">
        {graph.edges.map((e) => {
          const pts = layout.edges[e.id];
          if (!pts) return null;
          const hot = !!hl && hl.edges.has(e.id);
          const incident = !hl && selected && (e.from === selected || e.to === selected);
          const invalid = delayMode && e.w < 0;
          const dim = hl ? !hot : (active && !marks.has(e.from) && !marks.has(e.to)) || (selected && !incident);
          const tone = hot || incident ? T.accent : invalid ? T.alert : T.line;
          const marker = hot || incident ? 'arrow-accent' : invalid ? 'arrow-alert' : 'arrow-line';
          const mid = midpoint(pts);
          const text = delayMode ? (e.w === 1 ? 'D' : `${e.w}D`) : String(e.w);
          const boxW = 24 + (text.length - 1) * 8;
          const boxTone = hot ? T.accent : invalid ? T.alert : T.ink;
          return (
            <g key={e.id} opacity={dim ? 0.18 : 1}>
              <path d={roundedPath(pts)} fill="none" stroke={tone} strokeWidth={hot ? 2.6 : incident ? 1.8 : 1.3} markerEnd={`url(#${marker})`} />
              {delayMode && e.w !== 0 && (
                <>
                  <rect x={mid.x - boxW / 2} y={mid.y - 12} width={boxW} height={24} fill={T.paper} stroke={boxTone} strokeWidth={hot ? 2 : 1.3} />
                  <Label text={text} x={mid.x} y={mid.y} size={14} fill={boxTone} />
                </>
              )}
              {!delayMode && (
                <text x={mid.x} y={mid.y - 8} textAnchor="middle" fontFamily={T.serif} fontSize="14"
                  fill={e.w < 0 ? T.alert : T.line} stroke={T.paper} strokeWidth="4" paintOrder="stroke">
                  {text}
                </text>
              )}
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
          const symbol = n.type === 'add' ? '+' : n.type === 'mul' ? '×' : null;
          const host = n.type === 'host';
          const timed = showTimes && n.type !== 'io' && n.type !== 'host';
          return (
            <g key={n.id} opacity={dim ? 0.3 : 1} style={{ cursor: 'pointer' }}
              onClick={(ev) => { ev.stopPropagation(); onSelect(n.id); }}>
              <circle cx={p.x} cy={p.y} r={R} fill={host ? T.ink : T.paper} stroke={stroke}
                strokeWidth={hot || isSel ? 2.4 : 1.5} strokeDasharray={n.type === 'io' ? '3 3' : undefined} />
              {symbol
                ? (<>
                    <Label text={symbol} x={p.x} y={p.y} size={22} />
                    <Label text={n.label} x={p.x + R * 0.8} y={p.y + R * 0.95} size={13} italic anchor="start" fill={T.line} />
                  </>)
                : <Label text={n.label} x={p.x} y={p.y} size={n.label.length > 3 ? 12 : 17} fill={host ? T.paper : T.ink} />}
              {timed && <Label text={`(${n.time})`} x={p.x + R * 0.85} y={p.y - R * 1.05} size={12} anchor="start" fill={T.line} />}
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
