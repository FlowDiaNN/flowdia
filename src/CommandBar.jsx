import { useState } from 'react';
import { COMMANDS } from './commands.js';

export default function CommandBar({ value, onChange, onSubmit, inputRef }) {
  const [focused, setFocused] = useState(false);
  const word = value.trimStart().split(/\s+/)[0].toLowerCase();
  const showList = focused && !/\s/.test(value.trimStart());
  const items = COMMANDS.filter((c) => c.name.startsWith(word));

  const choose = (c) => {
    if (c.args) onChange(`${c.name} `);
    else onSubmit(c.name);
  };

  return (
    <div className={`bar${focused ? ' focused' : ''}${showList && items.length ? ' open' : ''}`}>
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
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(value); }}
        />
        {!focused && <kbd>/</kbd>}
      </div>
      {showList && items.length > 0 && (
        <ul role="listbox">
          {items.map((c) => (
            <li key={c.name} role="option" onMouseDown={(e) => { e.preventDefault(); choose(c); }}>
              <span className="name">{c.name}</span>
              <span className="desc">{c.desc}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
