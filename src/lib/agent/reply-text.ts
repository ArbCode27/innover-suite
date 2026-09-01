const HANGING_LAST_WORD =
  /^(el|la|los|las|un|una|unos|unas|mi|mis|tu|tus|su|sus|nuestro|nuestra|nuestros|nuestras|vuestro|vuestra|de|del|al|con|sin|por|para|entre|hacia|según|segun|como|que|y|e|o|u|ni|pero|aunque|si|te|se|me|le|les|lo|este|esta|estos|estas|ese|esa)$/iu;

const HANGING_DETERMINER =
  /^(el|la|los|las|un|una|unos|unas|mi|mis|tu|tus|su|sus|nuestro|nuestra|nuestros|nuestras|este|esta|estos|estas|ese|esa|del|al)$/iu;

const ENDS_WITH_OPEN_PUNCT = /[:;,—–\-(¿¡]$/u;
const ENDS_WITH_CLOSE = /[.!?…»"'”')\u00BB]$/u;
const ENDS_WITH_EMOJI = /\p{Extended_Pictographic}$/u;

const stripTrailingQuotes = (value: string) => value.replace(/["'`«»“”*]+$/g, "");

const hasUnclosedMarkup = (text: string) => {
  const boldMarks = text.match(/\*\*/g)?.length ?? 0;
  if (boldMarks % 2 === 1) return true;
  const openParens = text.match(/\(/g)?.length ?? 0;
  const closeParens = text.match(/\)/g)?.length ?? 0;
  return openParens > closeParens;
};

export const isIncompleteAgentReply = (value: string) => {
  const text = value.trim();
  if (!text) return false;
  if (ENDS_WITH_OPEN_PUNCT.test(text) || hasUnclosedMarkup(text)) return true;
  if (ENDS_WITH_CLOSE.test(text) || ENDS_WITH_EMOJI.test(text)) return false;

  const words = stripTrailingQuotes(text).split(/\s+/).filter(Boolean);
  const lastWord = words.at(-1) ?? "";
  const previousWord = words.at(-2) ?? "";
  return HANGING_LAST_WORD.test(lastWord) || HANGING_DETERMINER.test(previousWord);
};

export const needsAgentReplyRepair = (value: string, truncated = false) => {
  if (isIncompleteAgentReply(value)) return true;
  if (!truncated) return false;
  const text = value.trim();
  if (!text) return false;
  if (ENDS_WITH_CLOSE.test(text) || ENDS_WITH_EMOJI.test(text)) return false;
  return true;
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
