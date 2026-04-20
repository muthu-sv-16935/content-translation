import DownloadButton from './DownloadButton.jsx';

function downloadHtml(html, targetLanguage) {
  const blob = new Blob([html], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = targetLanguage ? `translated-${targetLanguage}.txt` : 'translated-output.txt';
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse translated HTML and return page title and meta description (from pipeline, not hardcoded). */
function getTitleAndDescriptionFromHtml(html) {
  if (!html || typeof html !== 'string') return { title: '', description: '' };
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const titleEl = doc.querySelector('title');
    const metaEl = doc.querySelector('meta[name="description"]');
    return {
      title: titleEl?.textContent?.trim() ?? '',
      description: metaEl?.getAttribute('content')?.trim() ?? '',
    };
  } catch {
    return { title: '', description: '' };
  }
}

export default function ResultViewer({ sourceHtml, translatedHtml, loading, targetLanguage }) {
  if (loading) {
    return (
      <section className="result-viewer result-viewer--loading">
        <div className="result-loading" aria-live="polite">
          <span className="result-spinner" aria-hidden />
          Fetching page and translating…
        </div>
      </section>
    );
  }

  if (!sourceHtml && !translatedHtml) {
    return (
      <section className="result-viewer result-viewer--empty">
        <p className="result-empty">Translated page will appear here.</p>
      </section>
    );
  }

  const { title, description } = getTitleAndDescriptionFromHtml(translatedHtml);

  return (
    <section className="result-viewer result-viewer--filled" aria-label="Translated page">
      <div className="result-toolbar">
        <DownloadButton
          label="Download Translated (.txt)"
          onClick={() => downloadHtml(translatedHtml, targetLanguage)}
        />
      </div>
      {(title || description) && (
        <div className="result-meta" aria-label="Translated page title and description">
          {title && (
            <div className="result-meta-row">
              <span className="result-meta-label">Page title</span>
              <span className="result-meta-value">{title}</span>
            </div>
          )}
          {description && (
            <div className="result-meta-row">
              <span className="result-meta-label">Meta description</span>
              <span className="result-meta-value">{description}</span>
            </div>
          )}
        </div>
      )}
      <div className="code-compare">
        <div className="code-pane">
          <div className="code-pane-header">Source HTML</div>
          <textarea
            className="code-pane-editor"
            readOnly
            value={sourceHtml}
            spellCheck={false}
            aria-label="Source HTML code"
          />
        </div>
        <div className="code-pane">
          <div className="code-pane-header">Translated HTML</div>
          <textarea
            className="code-pane-editor"
            readOnly
            value={translatedHtml}
            spellCheck={false}
            aria-label="Translated HTML code"
          />
        </div>
      </div>
    </section>
  );
}
