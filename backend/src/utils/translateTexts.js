const TRANSLATE_ENDPOINT = 'https://clients5.google.com/translate_a/t';
const MAX_BATCH_ITEMS = 10;
const MAX_BATCH_QUERY_LENGTH = 12000;

const vietnameseCharacters = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

export const hasVietnameseCharacters = (text) => vietnameseCharacters.test(text);

const buildBatches = (items) => {
  const batches = [];
  let batch = [];
  let queryLength = 0;

  for (const item of items) {
    const encodedLength = encodeURIComponent(item.text).length;
    if (batch.length > 0 && (batch.length >= MAX_BATCH_ITEMS || queryLength + encodedLength > MAX_BATCH_QUERY_LENGTH)) {
      batches.push(batch);
      batch = [];
      queryLength = 0;
    }
    batch.push(item);
    queryLength += encodedLength;
  }

  if (batch.length > 0) batches.push(batch);
  return batches;
};

const requestBatch = async (batch, targetLanguage, fetchImpl) => {
  const params = new URLSearchParams({ client: 'dict-chrome-ex', sl: 'auto', tl: targetLanguage });
  batch.forEach(({ text }) => params.append('q', text));

  const response = await fetchImpl(`${TRANSLATE_ENDPOINT}?${params}`, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KaitoTodo/1.0)' },
  });
  if (!response.ok) throw new Error(`Translation provider responded ${response.status}`);

  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length !== batch.length) {
    throw new Error('Unexpected translation response');
  }

  return payload.map((item, index) => {
    const value = Array.isArray(item) ? item[0] : item;
    return typeof value === 'string' && value.trim() ? value : batch[index].text;
  });
};

export const translateTexts = async (texts, targetLanguage, { fetchImpl = fetch } = {}) => {
  const translations = [...texts];
  const pending = [];

  texts.forEach((text, index) => {
    if (!text.trim()) return;
    if (targetLanguage === 'en' && !hasVietnameseCharacters(text)) return;
    pending.push({ text, index });
  });

  let fallback = false;
  for (const batch of buildBatches(pending)) {
    try {
      const values = await requestBatch(batch, targetLanguage, fetchImpl);
      batch.forEach((item, index) => {
        translations[item.index] = values[index];
      });
    } catch (error) {
      console.error('Notification translation error:', error.message);
      fallback = true;
      break;
    }
  }

  return { translations, fallback };
};
