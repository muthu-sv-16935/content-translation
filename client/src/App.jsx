import { useState } from 'react';
import UrlTranslator from './components/UrlTranslator.jsx';
import FileTranslator from './components/FileTranslator.jsx';
import ResultViewer from './components/ResultViewer.jsx';
import './App.css';

const TABS = [
  { id: 'url', label: 'Translate by URL' },
  { id: 'file', label: 'Upload .properties file' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('url');
  const [sourceHtml, setSourceHtml] = useState('');
  const [translatedHtml, setTranslatedHtml] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [urlTargetLang, setUrlTargetLang] = useState('');

  return (
    <div className="app">
      <div className="app-top">
        <header className="app-header">
          <h1>Translation</h1>
          <p className="app-tagline">
            Uses memory: only new text is translated. Same word in different places stays in the right spot.
          </p>
        </header>

        <div className="tab-list" role="tablist" aria-label="Translation mode">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              className={`tab-trigger ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id="panel-url"
          role="tabpanel"
          aria-labelledby="tab-url"
          hidden={activeTab !== 'url'}
          className="tab-panel"
        >
          <UrlTranslator
            loading={urlLoading}
            error={urlError}
            targetLang={urlTargetLang}
            setSourceHtml={setSourceHtml}
            setTranslatedHtml={setTranslatedHtml}
            setLoading={setUrlLoading}
            setError={setUrlError}
            setTargetLang={setUrlTargetLang}
          />
        </div>
        <div
          id="panel-file"
          role="tabpanel"
          aria-labelledby="tab-file"
          hidden={activeTab !== 'file'}
          className="tab-panel"
        >
          <FileTranslator />
        </div>
      </div>

      {activeTab === 'url' && (
        <section className="app-preview" aria-label="Preview">
          <ResultViewer
            sourceHtml={sourceHtml}
            translatedHtml={translatedHtml}
            loading={urlLoading}
            targetLanguage={urlTargetLang}
          />
        </section>
      )}
    </div>
  );
}
