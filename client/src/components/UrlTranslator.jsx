import { useState } from 'react';
import UrlInput from './UrlInput.jsx';
import LanguageSelector from './LanguageSelector.jsx';

export default function UrlTranslator({
  loading,
  error,
  targetLang,
  setSourceHtml,
  setTranslatedHtml,
  setLoading,
  setError,
  setTargetLang,
}) {
  const [url, setUrl] = useState('');

  async function handleTranslate() {
    if (!url.trim()) return;
    setError('');
    setLoading(true);
    setSourceHtml('');
    setTranslatedHtml('');
    try {
      const res = await fetch('/api/translate-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), targetLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSourceHtml(data.sourceHtml ?? '');
      setTranslatedHtml(data.translatedHtml ?? '');
    } catch (e) {
      setError(e.message || 'Translation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mode-panel mode-panel--form-only">
      <h2 className="panel-section-title">Translate webpage by URL</h2>
      <div className="url-section-card">
        <div className="url-mode-row">
          <UrlInput
            value={url}
            onChange={setUrl}
            onTranslate={handleTranslate}
            disabled={loading}
          />
          <LanguageSelector
            value={targetLang}
            onChange={setTargetLang}
            disabled={loading}
          />
          <button
            type="button"
            className="translate-btn"
            onClick={handleTranslate}
            disabled={loading || !url.trim() || !targetLang}
            aria-label={loading ? 'Translating...' : 'Translate'}
            aria-busy={loading}
          >
            {loading ? 'Translating…' : 'Translate'}
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
