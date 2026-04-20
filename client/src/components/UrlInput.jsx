export default function UrlInput({ value, onChange, onTranslate, disabled }) {
  return (
    <div className="url-input-wrap">
      <label htmlFor="page-url" className="url-label">
        Page URL
      </label>
      <input
        id="page-url"
        type="url"
        className="url-input"
        placeholder="https://example.com/page"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onTranslate()}
        disabled={disabled}
        autoComplete="url"
      />
    </div>
  );
}
