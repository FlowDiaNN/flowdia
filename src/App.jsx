import { useEffect, useMemo, useRef, useState } from 'react';
import GraphView from './GraphView.jsx';
import CommandBar from './CommandBar.jsx';
import StatusBar from './StatusBar.jsx';
import { analyzeLoops } from './analysis.js';
import { parseGraph, serializeGraph } from './model.js';
import { retime, unfold, bellmanFord } from './transforms.js';
import { layoutGraph } from './layout.js';
import { SAMPLES } from './samples.js';
import { COMMANDS } from './commands.js';

const ok = (text) => ({ text, kind: 'ok' });
const warn = (text) => ({ text, kind: 'warn' });
const HINT = { text: 'Click a node, drag to pan, scroll to zoom. Press / to search or run a command.', kind: 'hint' };

export default function App() {
  const [history, setHistory] = useState(() => [{ label: 'iir', graph: parseGraph(SAMPLES.iir.text) }]);
  const [idx, setIdx] = useState(0);
  const graph = history[idx].graph;

  // Loop bounds and the loop (or critical loops) highlighted by hovering the status bar.
  const analysis = useMemo(() => (graph.weights === 'delay' ? analyzeLoops(graph) : null), [graph]);
  const [hover, setHover] = useState(null);
  useEffect(() => setHover(null), [analysis]);
  const hl = useMemo(() => {
    if (!analysis || !hover) return null;
    const ls = hover.kind === 'bound' ? analysis.critical : [analysis.loops[hover.i]].filter(Boolean);
    if (!ls.length) return null;
    return { nodes: new Set(ls.flatMap((l) => l.nodes)), edges: new Set(ls.flatMap((l) => l.edges)) };
  }, [analysis, hover]);

  const [view, setView] = useState(null); // { graph, layout }
  const [input, setInput] = useState('');
  const [message, setMessage] = useState(HINT);
  const [selected, setSelected] = useState(null);
  const [marks, setMarks] = useState(null);
  const [solution, setSolution] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState('');
  const [editorError, setEditorError] = useState('');

  const inputRef = useRef(null);
  const viewRef = useRef(null);

  // Layout whenever the graph changes.
  useEffect(() => {
    let live = true;
    layoutGraph(graph)
      .then((layout) => live && setView({ graph, layout }))
      .catch((e) => live && setMessage({ text: `Layout failed: ${e.message}`, kind: 'error' }));
    return () => { live = false; };
  }, [graph]);

  useEffect(() => {
    setEditorText(serializeGraph(graph));
    setEditorError('');
  }, [graph]);

  const push = (label, next) => {
    setHistory((h) => [...h.slice(0, idx + 1), { label, graph: next }]);
    setIdx(idx + 1);
    setSolution(null);
    setMarks(null);
    setSelected(null);
  };

  const goto = (i) => {
    setIdx(Math.max(0, Math.min(history.length - 1, i)));
    setSolution(null);
    setMarks(null);
    setSelected(null);
  };

  const run = (line) => {
    const [cmd, ...args] = line.trim().split(/\s+/);
    switch (cmd) {
      case 'retime': {
        if (!args.length) throw new Error('Give node=value pairs, for example: retime 3=-1 5=1');
        const r = {};
        for (const a of args) {
          const m = a.match(/^([\w.]+)=(-?\d+)$/);
          if (!m) throw new Error(`Can't read "${a}". Write it as node=value, for example 3=-1.`);
          if (!graph.nodes.some((n) => n.id === m[1])) throw new Error(`There is no node "${m[1]}".`);
          r[m[1]] = parseInt(m[2], 10);
        }
        const next = retime(graph, r);
        push(`retime ${args.join(' ')}`, next);
        const bad = next.edges.filter((e) => e.w < 0).length;
        if (graph.weights === 'delay' && bad) return warn(`Retimed, but ${bad} edge${bad > 1 ? 's' : ''} now carry negative delay (shown in red).`);
        return ok(graph.weights === 'delay' ? 'Retimed. Every edge has a nonnegative delay.' : 'Retimed.');
      }
      case 'unfold': {
        const J = parseInt(args[0], 10);
        if (!Number.isInteger(J) || J < 1 || J > 16) throw new Error('Give an unfolding factor from 1 to 16, for example: unfold 4');
        push(`unfold ${J}`, unfold(graph, J));
        return ok(`Unfolded by J = ${J}: ${graph.nodes.length * J} nodes, ${graph.edges.length * J} edges.`);
      }
      case 'solve': {
        const source = args[0] ?? (graph.nodes.find((n) => n.type === 'host') ?? graph.nodes[0]).id;
        if (!graph.nodes.some((n) => n.id === source)) throw new Error(`There is no node "${source}".`);
        const res = bellmanFord(graph, source);
        if (!res.feasible) {
          setSolution(null);
          setMarks(new Set(res.cycle));
          return { text: `No solution. Negative cycle: ${[...res.cycle, res.cycle[0]].join(' → ')}.`, kind: 'error' };
        }
        setMarks(null);
        setSolution(res.r);
        const lost = Object.entries(res.r).filter(([, v]) => !Number.isFinite(v)).map(([k]) => k);
        return ok(`Feasible from ${source}. Shortest-path distances are shown above the nodes.${lost.length ? ` Not reachable: ${lost.join(', ')}.` : ''}`);
      }
      case 'load': {
        const name = args[0];
        const sample = SAMPLES[name];
        if (!sample) throw new Error(`Unknown example. Try: ${Object.keys(SAMPLES).join(', ')}.`);
        setHistory([{ label: name, graph: parseGraph(sample.text) }]);
        setIdx(0);
        setSolution(null);
        setMarks(null);
        setSelected(null);
        return ok(`Opened "${sample.title}"${sample.source ? ` (${sample.source})` : ''}.`);
      }
      case 'edit': setEditorOpen((o) => !o); return HINT;
      case 'fit': viewRef.current?.fit(); return HINT;
      case 'undo': goto(idx - 1); return HINT;
      case 'redo': goto(idx + 1); return HINT;
      case 'export': viewRef.current?.exportSvg(); return ok('Exported graph.svg.');
      default: throw new Error(`Unknown command "${cmd}".`);
    }
  };

  const onChangeInput = (value) => {
    setInput(value);
    const word = value.trim().split(/\s+/)[0].toLowerCase();
    if (!value.trim() || COMMANDS.some((c) => c.name === word)) {
      setMarks(null);
      setMessage(HINT);
      return;
    }
    const q = value.trim().toLowerCase();
    const hits = new Set(graph.nodes.filter((n) => n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q)).map((n) => n.id));
    setMarks(hits);
    setMessage(hits.size ? ok(`${hits.size} node${hits.size > 1 ? 's' : ''} match.`) : warn('No node matches.'));
  };

  const onSubmit = (value) => {
    const word = value.trim().split(/\s+/)[0].toLowerCase();
    if (!word) return;
    if (COMMANDS.some((c) => c.name === word)) {
      try {
        setMessage(run(value));
      } catch (e) {
        setMessage({ text: e.message, kind: 'error' });
        return;
      }
      setInput('');
      inputRef.current?.blur();
    } else if (marks && marks.size) {
      setSelected([...marks][0]);
      inputRef.current?.blur();
    }
  };

  const onSelect = (id) => {
    setHover(null);
    setSelected(id);
    if (!id) return setMessage(HINT);
    const n = graph.nodes.find((x) => x.id === id);
    const ins = graph.edges.filter((e) => e.to === id).length;
    const outs = graph.edges.filter((e) => e.from === id).length;
    setMessage({ text: `Node ${n.label}, ${n.type}. ${ins} in, ${outs} out.`, kind: 'hint' });
  };

  const applyEditor = () => {
    try {
      const g = parseGraph(editorText);
      push('edit', g);
      setEditorError('');
      setMessage(ok('Applied your edit.'));
    } catch (e) {
      setEditorError(e.message);
    }
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setInput('');
        setMarks(null);
        setSelected(null);
        setHover(null);
        setMessage(HINT);
        document.activeElement?.blur();
      } else if (!typing && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (!typing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        goto(e.shiftKey ? idx + 1 : idx - 1);
      } else if (!typing && !e.metaKey && !e.ctrlKey && e.key === 'f') {
        viewRef.current?.fit();
      } else if (!typing && !e.metaKey && !e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        setEditorOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="app">
      {editorOpen && (
        <aside className="editor">
          <textarea
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') applyEditor(); }}
            spellCheck={false}
            aria-label="Graph text"
          />
          {editorError && <p className="error">{editorError}</p>}
          <div className="row">
            <button onClick={applyEditor}>Apply changes</button>
            <span>Ctrl+Enter</span>
          </div>
        </aside>
      )}

      {view && (
        <GraphView ref={viewRef} graph={view.graph} layout={view.layout}
          selected={selected} marks={marks} solution={solution} hl={hl} onSelect={onSelect} />
      )}

      <header className={`top${editorOpen ? ' shifted' : ''}`}>
        <CommandBar value={input} onChange={onChangeInput} onSubmit={onSubmit} inputRef={inputRef} />
        <p className={`status ${message.kind}`} aria-live="polite">{message.text}</p>
      </header>

      {history.length > 1 && (
        <nav className={`trail${editorOpen ? ' shifted' : ''}`} aria-label="History">
          {history.map((h, i) => (
            <button key={i} className={i === idx ? 'current' : ''} onClick={() => goto(i)}>
              {i === 0 ? `${h.label}` : h.label}
            </button>
          ))}
        </nav>
      )}

      <StatusBar analysis={analysis} hover={hover} onHover={setHover} shifted={editorOpen} />
    </div>
  );
}
