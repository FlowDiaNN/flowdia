import { useState } from 'react';
import { COMMANDS } from './commands.js';
import { SAMPLES } from './samples.js';

export default function CommandBar({ value, onChange, onSubmit, inputRef }) {
  const [focused, setFocused] = useState(false);

  const trimmed = value.trimStart();
  const [first, ...rest] = trimmed.split(/\s+/);
  const word = first.toLowerCase();
  const typingArgs = /\s/.test(trimmed);
  const query = rest.join(' ').trim().toLowerCase();
  const sampleMode = focused && word === 'load' && typingArgs;

  let rows = [];
  if (focused && !typingArgs) {
    rows = COMMANDS.filter((c) => c.name.startsWith(word)).map((c) => ({
      key: c.name,
      name: c.name,
      desc: c.desc,
      pick: () => (c.args ? onChange(`${c.name} `) : onSubmit(c.name)),
    }));
  } else if (sampleMode) {
    rows = Object.entries(SAMPLES)
      .filter(([id, s]) => id.startsWith(query) || s.title.toLowerCase().includes(query))
      .map(([id, s]) => ({
        key: id,
        name: id,
        desc: s.source ? `${s.title}, ${s.source}` : s.title,
        pick: () => onSubmit(`load ${id}`),
      }));
  }

  const onEnter = () => {
    if (sampleMode && rows.length && !SAMPLES[query]) onSubmit(`load ${rows[0].name}`);
    else onSubmit(value);
  };

  return (
    <div className={`bar${focused ? ' focused' : ''}${rows.length ? ' open' : ''}`}>
      <div className="field">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={value}
          placeholder="Find a node or run a command"
          aria-label="Find a node or run a command"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
        />
        {!focused && <kbd>/</kbd>}
      </div>
      {rows.length > 0 && (
        <ul role="listbox">
          {rows.map((r) => (
            <li key={r.key} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); r.pick(); }}>
              <span className="name">{r.name}</span>
              <span className="desc">{r.desc}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
