"""
FastAPI microservice for NLLB-200 batch translation and fluency correction.
Load model once at startup.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from translator import translate_batch

app = FastAPI(title="Translation Service (NLLB-200)")


class TranslateBatchRequest(BaseModel):
    texts: list[str]
    target_lang: str


class TranslateBatchResponse(BaseModel):
    translations: list[str]


class FluencyCorrectRequest(BaseModel):
    sentences: list[str]
    target_lang: str


class FluencyCorrectResponse(BaseModel):
    sentences: list[str]


class UiToneRequest(BaseModel):
    sentences: list[str]
    sources: list[str]
    target_lang: str


class UiToneResponse(BaseModel):
    sentences: list[str]


def _fluency_correct_batch(sentences: list[str], target_lang: str) -> list[str]:
    """
    Post-translation improvement step: improve fluency, grammar, and UI tone.

    Contract (must be preserved by any real implementation):
    - Input: list of translated strings, NLLB target_lang code (e.g. "tam_Taml").
    - Output: list of rewritten strings of the same length and same order.
    - FLUENCY_TOKEN_N placeholders (e.g. FLUENCY_TOKEN_0, FLUENCY_TOKEN_1) MUST be
      returned verbatim — they stand for %d, {0}, ${var}, etc. from the original text.
    - Each sentence should be rewritten to:
        1. Sound natural in the target language (fluency, word order).
        2. Be grammatically correct (fix literal translations, punctuation,
           language-specific rules such as verb placement in Tamil/Japanese).
        3. Use a concise, polite, user-interface-appropriate tone — avoid overly
           literal or formal phrasing suitable only for documents.
    - Do NOT change meaning, remove words, or alter named entities.

    Implementation options:
    - LLM (e.g. GPT-4, Gemini) with a system prompt enforcing the contract above.
    - A dedicated naturalness/grammar model for the target script.
    - Keep this stub (returns sentences unchanged) until a real backend is integrated.

    Current status: STUB — returns sentences unchanged.
    """
    return list(sentences)


@app.post("/translate-batch", response_model=TranslateBatchResponse)
async def post_translate_batch(body: TranslateBatchRequest):
    try:
        translations = translate_batch(body.texts, body.target_lang)
        return TranslateBatchResponse(translations=translations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _ui_tone_normalize_batch(sentences: list[str], sources: list[str], target_lang: str) -> list[str]:
    """
    UI tone normalization: rewrite short translated UI commands to sound natural
    and user-friendly for software buttons, menus, and commands.

    Contract (must be preserved by any real implementation):
    - Input:  list of translated UI command strings (already fluency-corrected),
              parallel list of original English source strings (same length),
              NLLB target_lang code (e.g. "tam_Taml").
    - Output: list of rewritten strings of the same length and same order.
    - UITONE_TOKEN_N placeholders (e.g. UITONE_TOKEN_0) MUST be returned verbatim.
      They stand for %d, {0}, ${var}, etc. from the original text.
    - Each sentence should be rewritten to:
        1. Use the natural tone for UI buttons / menu items / commands in the target language.
           Example: Tamil "ரத்து செய்" → "ரத்து செய்யவும்" (action verb form).
        2. Be concise and polite.
        3. Preserve meaning exactly — do not add or remove content.
    - Single-word terms that already sound correct (e.g. German "Speichern") should
      be returned unchanged.

    Recommended LLM prompt (one call per sentence, or batched):
      system:
        "You are a software UI localisation expert."
      user:
        "Rewrite the following translated UI string to sound natural and user-friendly
         for a software button, menu item, or command in <target_lang>.
         Requirements:
           - Preserve the original meaning exactly.
           - Use the natural action-oriented tone for UI commands.
           - Keep it concise.
           - Return all UITONE_TOKEN_N placeholders exactly as they appear.
           - Do not translate or change brand names.
         Original English: <source>
         Translated text: <sentence>
         Return only the corrected sentence. No explanation."

    Current status: STUB — returns sentences unchanged.
    """
    return list(sentences)


@app.post("/fluency-correct", response_model=FluencyCorrectResponse)
async def post_fluency_correct(body: FluencyCorrectRequest):
    try:
        sentences = _fluency_correct_batch(body.sentences, body.target_lang)
        return FluencyCorrectResponse(sentences=sentences)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ui-tone-normalize", response_model=UiToneResponse)
async def post_ui_tone_normalize(body: UiToneRequest):
    try:
        sentences = _ui_tone_normalize_batch(body.sentences, body.sources, body.target_lang)
        return UiToneResponse(sentences=sentences)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}
