import type { TranslateRequest, TranslateResponse } from '@justcampus/shared'

/** The service behind the translator. Swap `translationProvider` to connect a real one. */
export interface TranslationProvider {
  translate(input: TranslateRequest, apiKey: string | null): Promise<TranslateResponse>
}

/** Placeholder until a real service is chosen: tags the text with the target language. */
export const translationProvider: TranslationProvider = {
  async translate({ text, target }) {
    return { translation: `[${target.toUpperCase()}] ${text}`, detectedSource: null }
  }
}
