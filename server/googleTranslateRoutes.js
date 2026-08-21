const MAX_TRANSLATION_LENGTH = 5000;
const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/;

const getApiKey = () =>
  String(process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

const getGoogleErrorMessage = (message = '') => {
  if (/has not been used.*before|it is disabled/i.test(message)) {
    return 'A Cloud Translation API está desativada no projeto Google Cloud. Ative a API, aguarde alguns minutos e tente novamente.';
  }
  if (/api key not valid/i.test(message)) {
    return 'A chave configurada para o Google Tradutor é inválida.';
  }
  if (/requests from referer|ip address.*not allowed/i.test(message)) {
    return 'A chave do Google Tradutor não permite requisições deste servidor. Revise as restrições da chave no Google Cloud.';
  }
  return message || 'O Google não retornou uma tradução válida.';
};

export const registerGoogleTranslateRoutes = (app) => {
  app.post('/api/google-translate/translate', async (req, res) => {
    const text = String(req.body?.text || '').trim();
    const sourceLanguage = String(req.body?.sourceLanguage || 'auto').trim();
    const targetLanguage = String(req.body?.targetLanguage || '').trim();

    if (!text) {
      return res.status(400).json({ success: false, message: 'Informe o texto que deseja traduzir.' });
    }
    if (text.length > MAX_TRANSLATION_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `O texto deve ter no máximo ${MAX_TRANSLATION_LENGTH} caracteres.`
      });
    }
    if (!LANGUAGE_CODE_PATTERN.test(targetLanguage)) {
      return res.status(400).json({ success: false, message: 'Selecione um idioma de destino válido.' });
    }
    if (sourceLanguage !== 'auto' && !LANGUAGE_CODE_PATTERN.test(sourceLanguage)) {
      return res.status(400).json({ success: false, message: 'Selecione um idioma de origem válido.' });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        message: 'Google Tradutor não configurado. Informe GOOGLE_TRANSLATE_API_KEY no servidor.'
      });
    }

    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: text,
            target: targetLanguage,
            format: 'text',
            ...(sourceLanguage === 'auto' ? {} : { source: sourceLanguage })
          })
        }
      );
      const payload = await response.json().catch(() => null);
      const translation = payload?.data?.translations?.[0];

      if (!response.ok || !translation?.translatedText) {
        throw new Error(getGoogleErrorMessage(payload?.error?.message));
      }

      return res.json({
        success: true,
        translatedText: translation.translatedText,
        detectedSourceLanguage: translation.detectedSourceLanguage || sourceLanguage
      });
    } catch (error) {
      console.error('[server] Google Translate failed', error);
      return res.status(502).json({
        success: false,
        message: error.message || 'Não foi possível traduzir o texto.'
      });
    }
  });
};
