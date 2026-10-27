import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVietnameseCharacters, translateTexts } from '../src/utils/translateTexts.js';

const jsonResponse = (payload) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

test('detects Vietnamese characters regardless of case', () => {
  assert.equal(hasVietnameseCharacters('Công việc đến hạn'), true);
  assert.equal(hasVietnameseCharacters('ĐÃ HOÀN THÀNH'), true);
  assert.equal(hasVietnameseCharacters('Task due now'), false);
});

test('translates Vietnamese text through the batch endpoint', async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(new URL(url));
    const texts = new URL(url).searchParams.getAll('q');
    return jsonResponse(texts.map((text) => [`translated:${text}`, 'vi']));
  };

  const result = await translateTexts(['Công việc đến hạn', ''], 'en', { fetchImpl });

  assert.deepEqual(result.translations, ['translated:Công việc đến hạn', '']);
  assert.equal(result.fallback, false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].origin, 'https://clients5.google.com');
  assert.equal(requests[0].searchParams.get('client'), 'dict-chrome-ex');
  assert.equal(requests[0].searchParams.get('tl'), 'en');
});

test('leaves English text untouched when translating to English', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return jsonResponse([]);
  };

  const result = await translateTexts(['Task due now', 'Another reminder'], 'en', { fetchImpl });

  assert.deepEqual(result.translations, ['Task due now', 'Another reminder']);
  assert.equal(result.fallback, false);
  assert.equal(called, false);
});

test('falls back to the original text when the provider rejects the request', async () => {
  const fetchImpl = async () => new Response('rate limited', { status: 429 });

  const result = await translateTexts(['Công việc đến hạn'], 'en', { fetchImpl });

  assert.deepEqual(result.translations, ['Công việc đến hạn']);
  assert.equal(result.fallback, true);
});

test('splits large notification lists into several requests', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    const texts = new URL(url).searchParams.getAll('q');
    return jsonResponse(texts.map((text) => [`translated:${text}`, 'vi']));
  };
  const texts = Array.from({ length: 25 }, (_, index) => `Thông báo số ${index}`);

  const result = await translateTexts(texts, 'en', { fetchImpl });

  assert.equal(calls, 3);
  assert.deepEqual(result.translations, texts.map((text) => `translated:${text}`));
  assert.equal(result.fallback, false);
});
