import { useState, useRef, useEffect } from 'react';
import { LANGUAGES } from '../utils/langMap.js';

export default function LanguageSelector({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selected = LANGUAGES.find((l) => l.code === value);
  const displayLabel = selected ? selected.label : 'Select Language';
  const displayIcon = selected ? selected.icon : '🌐';

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="language-selector-wrap" ref={wrapperRef}>
      <label className="language-label">Target language</label>
      <div className="language-dropdown">
        <button
          type="button"
          className="language-dropdown-trigger"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Select target language"
        >
          <span className="language-dropdown-icon" aria-hidden>
            {displayIcon}
          </span>
          <span className="language-dropdown-label">{displayLabel}</span>
          <span className="language-dropdown-chevron" aria-hidden>
            {open ? '▲' : '▼'}
          </span>
        </button>
        {open && (
          <ul
            className="language-dropdown-list"
            role="listbox"
            aria-label="Target language options"
          >
            {LANGUAGES.map((lang) => (
              <li key={lang.code} role="option" aria-selected={value === lang.code}>
                <button
                  type="button"
                  className={`language-dropdown-option ${value === lang.code ? 'is-selected' : ''}`}
                  onClick={() => {
                    onChange(lang.code);
                    setOpen(false);
                  }}
                >
                  <span className="language-option-icon" aria-hidden>
                    {lang.icon}
                  </span>
                  <span className="language-option-label">{lang.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
