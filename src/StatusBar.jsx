import { boundText, fmt, loopLabel, pathText } from './analysis.js';

const SHOWN = 200;

export default function StatusBar({ analysis, hover, onHover, shifted }) {
  const cls = `metrics${shifted ? ' shifted' : ''}`;

  if (!analysis) {
    return <footer className={cls}><span>Loop and iteration bounds need a delay graph.</span></footer>;
  }
  if (!analysis.loops.length) {
    return <footer className={cls}><span>This graph has no loops, so it has no iteration bound.</span></footer>;
  }

  // Mouse hover highlights; keyboard focus and taps do the same.
  const bind = (h) => ({
    onPointerEnter: (e) => { if (e.pointerType === 'mouse') onHover(h); },
    onPointerLeave: (e) => { if (e.pointerType === 'mouse') onHover(null); },
    onFocus: () => onHover(h),
    onBlur: () => onHover(null),
    onClick: () => onHover(h),
  });

  const bounded = Number.isFinite(analysis.bound);
  const boundOn = hover?.kind === 'bound';
  const hovered = hover?.kind === 'loop' ? analysis.loops[hover.i] : null;
  const crit = analysis.critical;

  let detail = '';
  if (hovered) {
    detail = hovered.invalid
      ? `Loop ${pathText(hovered)} ${hovered.W === 0 ? 'has no delay' : 'has negative total delay'}. Retime or add a delay.`
      : `${pathText(hovered)}: ${fmt(hovered.T)} u.t. over ${fmt(hovered.W)} delay${hovered.W === 1 ? '' : 's'}`;
  } else if (boundOn) {
    detail = `Critical loop${crit.length > 1 ? 's' : ''}: ${pathText(crit[0])}${crit.length > 1 ? ` and ${crit.length - 1} more` : ''}`;
  }

  return (
    <footer className={cls}>
      <button type="button" className={`bound${boundOn ? ' on' : ''}${bounded ? '' : ' bad'}`} {...bind({ kind: 'bound' })}>
        <span className="k">Iteration bound</span>
        <span className="v">{boundText(analysis)}</span>
      </button>

      <div className="loops" role="group" aria-label="Loop bounds">
        <span className="k">Loop bounds</span>
        {analysis.loops.slice(0, SHOWN).map((l, i) => (
          <button
            type="button"
            key={i}
            className={`loop${l.critical ? ' crit' : ''}${l.invalid ? ' bad' : ''}${hover?.kind === 'loop' && hover.i === i ? ' on' : ''}`}
            title={pathText(l)}
            {...bind({ kind: 'loop', i })}
          >
            {loopLabel(l)}
          </button>
        ))}
        {analysis.loops.length > SHOWN && <span className="k">and {analysis.loops.length - SHOWN} more</span>}
        {analysis.capped && <span className="k">Search stopped early.</span>}
      </div>

      <span className="detail" aria-live="polite">{detail}</span>
    </footer>
  );
}
