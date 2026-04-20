/**
 * Frontend language options and NLLB code mapping (must match server).
 */
export const LANGUAGES = [
   // Indian languages (official and widely spoken)
   { code: 'hi', label: 'हिन्दी (Hindi)', nllb: 'hin_Deva', icon: '🇮🇳' },
   { code: 'bn', label: 'বাংলা (Bengali)', nllb: 'ben_Beng', icon: '🇮🇳' },
   { code: 'te', label: 'తెలుగు (Telugu)', nllb: 'tel_Telu', icon: '🇮🇳' },
   { code: 'mr', label: 'मराठी (Marathi)', nllb: 'mar_Deva', icon: '🇮🇳' },
   { code: 'ta', label: 'தமிழ் (Tamil)', nllb: 'tam_Taml', icon: '🇮🇳' },
   { code: 'gu', label: 'ગુજરાતી (Gujarati)', nllb: 'guj_Gujr', icon: '🇮🇳' },
   { code: 'ur', label: 'اردو (Urdu)', nllb: 'urd_Arab', icon: '🇮🇳' },
   { code: 'kn', label: 'ಕನ್ನಡ (Kannada)', nllb: 'kan_Knda', icon: '🇮🇳' },
   { code: 'ml', label: 'മലയാളം (Malayalam)', nllb: 'mal_Mlym', icon: '🇮🇳' },
   { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)', nllb: 'pan_Guru', icon: '🇮🇳' },
   
  { code: 'es', label: 'Español', nllb: 'spa_Latn', icon: '🇪🇸' },
  { code: 'pt-BR', label: 'Português (Brasil)', nllb: 'por_Latn', icon: '🇧🇷' },
  { code: 'nl', label: 'Nederlands', nllb: 'nld_Latn', icon: '🇳🇱' },
  { code: 'de', label: 'Deutsch', nllb: 'deu_Latn', icon: '🇩🇪' },
  { code: 'id', label: 'Bahasa Indonesia', nllb: 'ind_Latn', icon: '🇮🇩' },
  { code: 'fr', label: 'Français', nllb: 'fra_Latn', icon: '🇫🇷' },
  { code: 'ar', label: 'العربية (Arabic)', nllb: 'arb_Arab', icon: '🌐' },
  { code: 'th', label: 'ภาษาไทย (Thai)', nllb: 'tha_Thai', icon: '🇹🇭' },
  { code: 'ja', label: '日本語 (Japanese)', nllb: 'jpn_Jpan', icon: '🇯🇵' },
  { code: 'vi', label: 'Tiếng Việt (Vietnamese)', nllb: 'vie_Latn', icon: '🇻🇳' },
 
];

// Note: frontend components read `nllb` directly from `LANGUAGES`.
