import { useState, useRef } from 'react';
import LanguageSelector from './LanguageSelector.jsx';

export default function FileTranslator() {
  const [file, setFile] = useState(null);
  const [targetLang, setTargetLang] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function handleTranslate() {
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('targetLang', targetLang);
      const res = await fetch('/api/translate-file', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition');
      const filenameMatch = disp && disp.match(/filename="([^"]+)"/);
      const name = filenameMatch
        ? filenameMatch[1]
        : (file.name || 'file.properties').replace(/\.properties$/i, '') + '-translated.properties';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Translation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mode-panel">
      <h2 className="panel-section-title">Upload .properties file</h2>
      <div className="url-section-card">
        <div className="file-mode-row">
          <div className="file-input-wrap">
            <label className="file-label">Properties file (.properties)</label>
            <div
              className="file-input-combo"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label={file ? `Chosen file: ${file.name}` : 'Choose file'}
            >
              <span className="file-input-combo-btn">Choose file</span>
              <span className="file-input-combo-status">
                {file ? file.name : 'No file chosen'}
              </span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".properties"
              className="file-input-hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
          <LanguageSelector
            value={targetLang}
            onChange={setTargetLang}
            disabled={loading}
          />
          <button
            type="button"
            className="translate-btn"
            onClick={handleTranslate}
            disabled={loading || !file || !targetLang}
            aria-label={loading ? 'Translating and preparing download' : 'Translate and download file'}
            aria-busy={loading}
          >
            {loading ? 'Translating…' : 'Translate & Download'}
          </button>
        </div>
      </div>
      {error && (
        <div className="app-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
