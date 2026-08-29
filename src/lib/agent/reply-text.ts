const HANGING_LAST_WORD =
  /^(el|la|los|las|un|una|unos|unas|mi|mis|tu|tus|su|sus|nuestro|nuestra|nuestros|nuestras|vuestro|vuestra|de|del|al|con|sin|por|para|entre|hacia|según|segun|como|que|y|e|o|u|ni|pero|aunque|si|te|se|me|le|les|lo|este|esta|estos|estas|ese|esa)$/iu;

const ENDS_WITH_OPEN_PUNCT = /[:;,—–\-(¿¡]$/u;
const ENDS_WITH_CLOSE = /[.!?…»"'”')\u00BB]$/u;

export const isIncompleteAgentReply = (value: string) => {
  const text = value.trim();
  if (!text) return false;
  if (ENDS_WITH_OPEN_PUNCT.test(text)) return true;
  if (ENDS_WITH_CLOSE.test(text)) return false;
  if (/\p{Extended_Pictographic}$/u.test(text)) return false;

  const lastWord = text.replace(/["'`«»“”]+$/g, "").split(/\s+/).pop() ?? "";
  return HANGING_LAST_WORD.test(lastWord);
};

export const resolveAgentReplyText = (draftText: string, laterText: string) => {
  const draft = draftText.trim();
  const later = laterText.trim();

  if (later && !isIncompleteAgentReply(later)) {
    return later;
  }

  if (draft && !isIncompleteAgentReply(draft)) {
    return draft;
  }

  if (later.length >= draft.length) {
    return later;
  }

  return draft;
};
