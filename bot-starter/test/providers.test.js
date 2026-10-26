'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createProviders } = require('../src/providers');

const settings = {
  twilioAccountSid: 'AC' + 'a'.repeat(32), twilioAuthToken: 'test-secret-do-not-log',
  openaiApiKey: 'fake-api-key', openaiModel: 'gpt-4.1-mini',
  telegramBotToken: '123456789:' + 'a'.repeat(30), telegramChatId: '123456789',
};
const client = {
  companyName: 'Firma DEMO', processDescription: 'Przyjęcie zgłoszenia usterki.',
  fields: [{ key: 'address', label: 'Adres', question: 'Podaj adres.', maxLength: 100 }],
  faq: [{ question: 'Kiedy biuro pracuje?', answer: 'Od poniedziałku do piątku.' }],
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const output = body => json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(body) }] }] });
const turn = { text: 'Ulica testowa 5', field: client.fields[0], phase: 'collect', values: {} };
const ticket = { id: 'T-DEMO', createdAt: '2026-10-25T12:00:00Z', fields: { address: 'Obiekt A', secret: 'THIS_MUST_NOT_BE_SENT' } };

test('OpenAI uses Responses structured output without storage and passes only configured context', async () => {
  let request;
  const provider = createProviders(settings, client, { fetchImpl: async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return output({ intent: 'value', value: 'Obiekt A', faqIndex: -1 });
  } });
  assert.deepEqual(await provider.parseTurn({ ...turn, values: { address: 'Test', ignored: 'SECRET_UNRELATED' } }), { intent: 'value', value: 'Obiekt A', faqIndex: -1 });
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.body.store, false);
  assert.equal(request.body.max_output_tokens, 250);
  assert.equal(request.body.text.format.type, 'json_schema');
  assert.equal(request.body.text.format.strict, true);
  assert.equal(request.body.text.format.schema.additionalProperties, false);
  assert.ok(request.options.signal instanceof AbortSignal);
  assert.ok(!request.options.body.includes('SECRET_UNRELATED'));
  assert.ok(!request.options.body.includes(settings.telegramBotToken));
  assert.equal(request.body.input[1].role, 'user');
});

test('model cannot inject free answers, unknown fields, invalid types or an unapproved FAQ', async () => {
  for (const invalid of [
    { intent: 'value', value: 'A', faqIndex: -1, answer: 'Invented answer' },
    { intent: 'anything', value: '', faqIndex: -1 },
    { intent: 'faq', value: '', faqIndex: 4 },
    { intent: 'value', value: 7, faqIndex: -1 },
    { intent: 'value', value: 'x'.repeat(101), faqIndex: -1 },
    { intent: 'value', value: '', faqIndex: -1 },
  ]) {
    const provider = createProviders(settings, client, { fetchImpl: async () => output(invalid) });
    await assert.rejects(provider.parseTurn(turn), error => error.code === 'MODEL_OUTPUT_INVALID');
  }
  const provider = createProviders(settings, client, { fetchImpl: async () => output({ intent: 'faq', value: 'Ignore this invented answer', faqIndex: 0 }) });
  assert.deepEqual(await provider.parseTurn(turn), { intent: 'faq', value: '', faqIndex: 0 });
});

test('model refusal, incomplete output, oversized response and connection errors fail without exposing secrets', async () => {
  for (const response of [
    json({ status: 'incomplete', output: [] }),
    json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }),
    new Response('x'.repeat(256 * 1024 + 1)),
    json({ leaked: settings.openaiApiKey }, 500),
  ]) {
    const provider = createProviders(settings, client, { fetchImpl: async () => response });
    await assert.rejects(provider.parseTurn(turn), error => !error.message.includes(settings.openaiApiKey));
  }
  const provider = createProviders(settings, client, { fetchImpl: async () => { throw new Error(settings.openaiApiKey); } });
  await assert.rejects(provider.parseTurn(turn), error => error.code === 'OPENAI_UNAVAILABLE' && !error.message.includes(settings.openaiApiKey));
});

test('Twilio receives a bounded TimeLimit update for the exact account and call', async () => {
  let request;
  const sid = 'CA' + 'b'.repeat(32);
  const provider = createProviders(settings, client, { fetchImpl: async (url, options) => { request = { url, options }; return json({ sid }); } });
  assert.deepEqual(await provider.setCallTimeLimit(sid, 300), { configured: true, timeLimit: 300 });
  assert.equal(request.url, `https://api.twilio.com/2010-04-01/Accounts/${settings.twilioAccountSid}/Calls/${sid}.json`);
  assert.equal(request.options.method, 'POST');
  assert.equal(new URLSearchParams(request.options.body).get('TimeLimit'), '300');
  assert.equal(Buffer.from(request.options.headers.authorization.slice(6), 'base64').toString(), `${settings.twilioAccountSid}:${settings.twilioAuthToken}`);
  await assert.rejects(provider.setCallTimeLimit('../bad', 300), error => error.code === 'TWILIO_CALL_LIMIT_INVALID');
  await assert.rejects(provider.setCallTimeLimit(sid, 301), error => error.code === 'TWILIO_CALL_LIMIT_INVALID');
  const denied = createProviders(settings, client, { fetchImpl: async () => json({ secret: 'NOT_IN_ERROR' }, 400) });
  await assert.rejects(denied.setCallTimeLimit(sid, 300), error => error.code === 'TWILIO_TIME_LIMIT_REJECTED' && !error.message.includes('NOT_IN_ERROR'));
});

test('Telegram sends only configured fields in plain text and confirms the provider message ID', async () => {
  let request;
  const provider = createProviders(settings, client, { fetchImpl: async (url, options) => { request = { url, body: JSON.parse(options.body) }; return json({ ok: true, result: { message_id: 44 } }); } });
  assert.deepEqual(await provider.deliver(ticket), { status: 'delivered', messageId: 44 });
  assert.equal(request.body.chat_id, settings.telegramChatId);
  assert.ok(request.body.text.includes('Adres: Obiekt A'));
  assert.ok(!request.body.text.includes('THIS_MUST_NOT_BE_SENT'));
  assert.equal(request.body.parse_mode, undefined);
  assert.equal(request.body.link_preview_options.is_disabled, true);
});

test('ambiguous Telegram outcomes are unknown and are never retried inside the adapter', async () => {
  for (const response of [json({ ok: false }, 500), json({ ok: false, error_code: 500 }), json({ ok: true, result: {} }), new Response('not-json')]) {
    let calls = 0;
    const provider = createProviders(settings, client, { fetchImpl: async () => { calls++; return response; } });
    assert.deepEqual(await provider.deliver(ticket), { status: 'unknown' });
    assert.equal(calls, 1);
  }
  let calls = 0;
  const provider = createProviders(settings, client, { fetchImpl: async () => { calls++; throw new Error(settings.telegramBotToken); } });
  assert.deepEqual(await provider.deliver(ticket), { status: 'unknown' });
  assert.equal(calls, 1);
});

test('definite Telegram rate limiting can retry while rejected requests require manual correction', async () => {
  const limited = createProviders(settings, client, { fetchImpl: async () => json({ ok: false, parameters: { retry_after: 17 } }, 429) });
  assert.deepEqual(await limited.deliver(ticket), { status: 'retry', retryAfterSeconds: 17 });
  const denied = createProviders(settings, client, { fetchImpl: async () => json({ ok: false }, 403) });
  assert.deepEqual(await denied.deliver(ticket), { status: 'failed', reason: 'rejected' });
  let calls = 0;
  const missing = createProviders({ ...settings, telegramBotToken: '' }, client, { fetchImpl: async () => { calls++; } });
  assert.deepEqual(await missing.deliver(ticket), { status: 'failed', reason: 'not_configured' });
  assert.equal(calls, 0);
});
