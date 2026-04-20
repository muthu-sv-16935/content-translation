/**
 * UI terminology glossary — small, focused, and maintainable.
 *
 * Purpose: Enforce consistent UI terminology across the product. Only true UI terms
 * and critical phrases are in the in-code glossary. Common phrases are left to the
 * translation model (NLLB).
 *
 * In-code: ~20–30 terms per language (core actions, navigation, auth, status, system).
 * Product-specific terms: use data/glossary.json so teams can maintain without code changes.
 *
 * Matching:
 *   - Input is normalized (trim, collapse spaces, lowercase) before lookup.
 *   - "Log In", "log in", "Log in" all match the same entry.
 *   - Optional pattern keys with one '*' (e.g. "Delete * files") match dynamically;
 *     the captured segment is substituted into the translation value's '*' if present.
 *
 * Pipeline: Brand protection → Glossary → Translation Memory → NLLB → Fluency → Validation
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Canonical UI terms only (~25 terms). Same key set for all languages.
// Categories: core actions, navigation, auth, status, system messages.
// ---------------------------------------------------------------------------

const GLOSSARY = {
  spa_Latn: {
    Save: 'Guardar',
    Cancel: 'Cancelar',
    Close: 'Cerrar',
    Submit: 'Enviar',
    Download: 'Descargar',
    Upload: 'Subir',
    Edit: 'Editar',
    View: 'Ver',
    Delete: 'Eliminar',
    Add: 'Agregar',
    Remove: 'Quitar',
    Next: 'Siguiente',
    Previous: 'Anterior',
    Back: 'Atrás',
    Continue: 'Continuar',
    'Log In': 'Iniciar sesión',
    'Sign In': 'Iniciar sesión',
    'Sign Up': 'Registrarse',
    'Log out': 'Cerrar sesión',
    'Sign out': 'Cerrar sesión',
    Loading: 'Cargando',
    Error: 'Error',
    Success: 'Éxito',
    Pending: 'Pendiente',
    Failed: 'Error',
    Warning: 'Advertencia',
    'No network': 'Sin conexión',
    'Try again': 'Volver a intentar',
  },
  por_Latn: {
    Save: 'Salvar',
    Cancel: 'Cancelar',
    Close: 'Fechar',
    Submit: 'Enviar',
    Download: 'Baixar',
    Upload: 'Enviar',
    Edit: 'Editar',
    View: 'Ver',
    Delete: 'Excluir',
    Add: 'Adicionar',
    Remove: 'Remover',
    Next: 'Próximo',
    Previous: 'Anterior',
    Back: 'Voltar',
    Continue: 'Continuar',
    'Log In': 'Entrar',
    'Sign In': 'Entrar',
    'Sign Up': 'Cadastrar',
    'Log out': 'Sair',
    'Sign out': 'Sair',
    Loading: 'Carregando',
    Error: 'Erro',
    Success: 'Sucesso',
    Pending: 'Pendente',
    Failed: 'Falhou',
    Warning: 'Aviso',
    'No network': 'Sem conexão',
    'Try again': 'Tentar novamente',
  },
  fra_Latn: {
    Save: 'Enregistrer',
    Cancel: 'Annuler',
    Close: 'Fermer',
    Submit: 'Envoyer',
    Download: 'Télécharger',
    Upload: 'Téléverser',
    Edit: 'Modifier',
    View: 'Afficher',
    Delete: 'Supprimer',
    Add: 'Ajouter',
    Remove: 'Retirer',
    Next: 'Suivant',
    Previous: 'Précédent',
    Back: 'Retour',
    Continue: 'Continuer',
    'Log In': 'Se connecter',
    'Sign In': 'Se connecter',
    'Sign Up': "S'inscrire",
    'Log out': 'Se déconnecter',
    'Sign out': 'Se déconnecter',
    Loading: 'Chargement',
    Error: 'Erreur',
    Success: 'Succès',
    Pending: 'En attente',
    Failed: 'Échec',
    Warning: 'Avertissement',
    'No network': 'Pas de connexion',
    'Try again': 'Réessayer',
  },
  tam_Taml: {
    Save: 'சேமி',
    Cancel: 'ரத்து செய்',
    Close: 'மூடு',
    Submit: 'சமர்ப்பி',
    Download: 'பதிவிறக்கு',
    Upload: 'பதிவேற்று',
    Edit: 'திருத்து',
    View: 'காண்க',
    Delete: 'நீக்கு',
    Add: 'சேர்',
    Remove: 'அகற்று',
    Next: 'அடுத்து',
    Previous: 'முந்தைய',
    Back: 'திரும்பு',
    Continue: 'தொடரவும்',
    'Log In': 'உள்நுழை',
    'Sign In': 'உள்நுழை',
    'Sign Up': 'பதிவு செய்',
    'Log out': 'வெளியேறு',
    'Sign out': 'வெளியேறு',
    Loading: 'ஏற்றுகிறது',
    Error: 'பிழை',
    Success: 'வெற்றி',
    Pending: 'நிலுவையில்',
    Failed: 'தோல்வி',
    Warning: 'எச்சரிக்கை',
    'No network': 'இணைய இணைப்பு இல்லை',
    'Try again': 'மீண்டும் முயற்சிக்கவும்',
  },
  hin_Deva: {
    Save: 'सहेजें',
    Cancel: 'रद्द करें',
    Close: 'बंद करें',
    Submit: 'जमा करें',
    Download: 'डाउनलोड करें',
    Upload: 'अपलोड करें',
    Edit: 'संपादित करें',
    View: 'देखें',
    Delete: 'हटाएं',
    Add: 'जोड़ें',
    Remove: 'हटाएं',
    Next: 'अगला',
    Previous: 'पिछला',
    Back: 'वापस',
    Continue: 'जारी रखें',
    'Log In': 'लॉग इन करें',
    'Sign In': 'साइन इन करें',
    'Sign Up': 'साइन अप करें',
    'Log out': 'लॉग आउट करें',
    'Sign out': 'साइन आउट करें',
    Loading: 'लोड हो रहा है',
    Error: 'त्रुटि',
    Success: 'सफलता',
    Pending: 'लंबित',
    Failed: 'विफल',
    Warning: 'चेतावनी',
    'No network': 'इंटरनेट कनेक्शन नहीं',
    'Try again': 'पुनः प्रयास करें',
  },
  deu_Latn: {
    Save: 'Speichern',
    Cancel: 'Abbrechen',
    Close: 'Schließen',
    Submit: 'Absenden',
    Download: 'Herunterladen',
    Upload: 'Hochladen',
    Edit: 'Bearbeiten',
    View: 'Anzeigen',
    Delete: 'Löschen',
    Add: 'Hinzufügen',
    Remove: 'Entfernen',
    Next: 'Weiter',
    Previous: 'Zurück',
    Back: 'Zurück',
    Continue: 'Fortfahren',
    'Log In': 'Anmelden',
    'Sign In': 'Anmelden',
    'Sign Up': 'Registrieren',
    'Log out': 'Abmelden',
    'Sign out': 'Abmelden',
    Loading: 'Wird geladen',
    Error: 'Fehler',
    Success: 'Erfolg',
    Pending: 'Ausstehend',
    Failed: 'Fehlgeschlagen',
    Warning: 'Warnung',
    'No network': 'Keine Verbindung',
    'Try again': 'Erneut versuchen',
  },
  arb_Arab: {
    Save: 'حفظ',
    Cancel: 'إلغاء',
    Close: 'إغلاق',
    Submit: 'إرسال',
    Download: 'تنزيل',
    Upload: 'رفع',
    Edit: 'تعديل',
    View: 'عرض',
    Delete: 'حذف',
    Add: 'إضافة',
    Remove: 'إزالة',
    Next: 'التالي',
    Previous: 'السابق',
    Back: 'رجوع',
    Continue: 'متابعة',
    'Log In': 'تسجيل الدخول',
    'Sign In': 'تسجيل الدخول',
    'Sign Up': 'تسجيل',
    'Log out': 'تسجيل الخروج',
    'Sign out': 'تسجيل الخروج',
    Loading: 'جارٍ التحميل',
    Error: 'خطأ',
    Success: 'نجاح',
    Pending: 'قيد الانتظار',
    Failed: 'فشل',
    Warning: 'تحذير',
    'No network': 'لا يوجد اتصال',
    'Try again': 'حاول مجددًا',
  },
  jpn_Jpan: {
    Save: '保存',
    Cancel: 'キャンセル',
    Close: '閉じる',
    Submit: '送信',
    Download: 'ダウンロード',
    Upload: 'アップロード',
    Edit: '編集',
    View: '表示',
    Delete: '削除',
    Add: '追加',
    Remove: '削除',
    Next: '次へ',
    Previous: '前へ',
    Back: '戻る',
    Continue: '続ける',
    'Log In': 'ログイン',
    'Sign In': 'サインイン',
    'Sign Up': 'サインアップ',
    'Log out': 'ログアウト',
    'Sign out': 'サインアウト',
    Loading: '読み込み中',
    Error: 'エラー',
    Success: '成功',
    Pending: '保留中',
    Failed: '失敗',
    Warning: '警告',
    'No network': '接続なし',
    'Try again': '再試行',
  },
};

// ---------------------------------------------------------------------------
// Load optional file-based glossary (data/glossary.json).
// Product-specific terminology lives here; file entries override in-code.
// Schema: { "<NLLB_code>": { "<source>": "<translated>", ... }, ... }
// Pattern keys with one '*' are supported (e.g. "Delete * files").
// ---------------------------------------------------------------------------
try {
  const glossaryPath = join(__dirname, '../../data/glossary.json');
  const raw = readFileSync(glossaryPath, 'utf8');
  const fileGlossary = JSON.parse(raw);
  if (fileGlossary && typeof fileGlossary === 'object' && !Array.isArray(fileGlossary)) {
    for (const lang of Object.keys(fileGlossary)) {
      if (lang.startsWith('_')) continue;
      const entries = fileGlossary[lang];
      if (entries && typeof entries === 'object') {
        GLOSSARY[lang] = Object.assign({}, GLOSSARY[lang] ?? {}, entries);
      }
    }
  }
} catch (e) {
  if (e.code !== 'ENOENT') {
    console.warn('[glossary] Failed to load data/glossary.json:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Thresholds: only short UI strings use glossary (model handles longer phrases).
// ---------------------------------------------------------------------------

const SHORT_WORD_THRESHOLD = 2;
const SHORT_CHAR_THRESHOLD = 30;

/**
 * Normalize text for lookup: trim, collapse spaces, lowercase.
 * Ensures "Log In", "log in", "Log in" all match the same key.
 * @param {string} text
 * @returns {string}
 */
function normalizeForLookup(text) {
  if (typeof text !== 'string') return '';
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Escape special regex characters (for pattern key → regex).
 * @param {string} s
 * @returns {string}
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a regex from a pattern key with a single '*'.
 * "Delete * files" → /^delete (.+?) files$/i
 * @param {string} patternKey
 * @returns {RegExp|null}
 */
function patternKeyToRegex(patternKey) {
  const parts = patternKey.split('*');
  if (parts.length !== 2) return null;
  const left = escapeRegex(parts[0].trim());
  const right = escapeRegex(parts[1].trim());
  return new RegExp(`^${left}\\s+(.+?)\\s+${right}$`, 'i');
}

/**
 * Check if text is a short UI string (≤2 words, ≤30 chars).
 * Longer phrases are translated by the model.
 * @param {string} text
 * @returns {boolean}
 */
export function isShortString(text) {
  if (typeof text !== 'string') return false;
  const normalized = text.trim().replace(/\s+/g, ' ');
  const wordCount = normalized.split(' ').filter(Boolean).length;
  return wordCount <= SHORT_WORD_THRESHOLD && normalized.length <= SHORT_CHAR_THRESHOLD;
}

/**
 * Look up translation in glossary.
 * 1. Normalize input (trim, collapse spaces, lowercase).
 * 2. Exact match: compare normalized input to normalized keys (skipped if patternOnly).
 * 3. Pattern match: keys containing exactly one '*' (e.g. "Delete * files");
 *    capture the wild segment and substitute into the value's '*' if present.
 * @param {string} text
 * @param {string} targetLang - NLLB code (e.g. spa_Latn)
 * @param {{ patternOnly?: boolean }} [opts] - If true, only try pattern keys (for longer strings).
 * @returns {string|null} Translation or null if not found
 */
export function glossaryLookup(text, targetLang, opts = {}) {
  const normalizedInput = normalizeForLookup(text);
  if (!normalizedInput) return null;

  const langGlossary = GLOSSARY[targetLang] ?? {};
  const keys = Object.keys(langGlossary);
  const patternOnly = opts.patternOnly === true;

  // 1. Exact match (normalized) — only when we allow exact match
  if (!patternOnly) {
    for (const key of keys) {
      if (key.includes('*')) continue;
      if (normalizeForLookup(key) === normalizedInput) {
        return langGlossary[key];
      }
    }
  }

  // 2. Pattern match (keys with exactly one '*')
  for (const key of keys) {
    if (!key.includes('*')) continue;
    const regex = patternKeyToRegex(key);
    if (!regex) continue;
    const m = text.trim().match(regex);
    if (!m) continue;
    const captured = m[1].trim();
    let value = langGlossary[key];
    if (typeof value !== 'string') return value;
    if (value.includes('*')) {
      value = value.replace(/\*/g, captured);
    }
    return value;
  }

  return null;
}

/**
 * Translate a batch of texts using glossary when applicable.
 * Only short UI strings (≤2 words, ≤30 chars) that match a glossary entry are
 * returned from the glossary; others go to NLLB. Glossary overrides model for matches.
 * @param {string[]} texts
 * @param {string} targetLang
 * @returns {{ translated: string[], toTranslateIndices: number[] }}
 */
export function glossaryTranslateBatch(texts, targetLang) {
  const translated = new Array(texts.length).fill(null);
  const toTranslateIndices = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text || !text.trim()) {
      translated[i] = '';
      continue;
    }
    const isShort = isShortString(text);
    // Short strings: try exact + pattern match. Long strings: try pattern match only (e.g. "Delete 3 files").
    const gloss = glossaryLookup(text, targetLang, { patternOnly: !isShort });
    if (gloss != null) {
      translated[i] = gloss;
      continue;
    }
    toTranslateIndices.push(i);
  }

  return { translated, toTranslateIndices };
}

export { GLOSSARY };
