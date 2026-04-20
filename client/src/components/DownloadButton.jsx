export default function DownloadButton({ label = 'Download', onClick, disabled }) {
  return (
    <button
      type="button"
      className="download-html-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {label}
    </button>
  );
}
