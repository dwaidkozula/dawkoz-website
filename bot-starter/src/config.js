'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function fail(message) { const error = new Error(message); error.code = 'CONFIG_INVALID'; throw error; }
function text(value, name, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(`Nieprawidłowe pole konfiguracji: ${name}.`);
  return value.trim();
}
function validateClient(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Konfiguracja klienta musi być obiektem JSON.');
  const allowed = ['clientId','companyName','greeting','processDescription','language','voice','fields','faq','monthlyMinutes','maxCallSeconds','maxTurns','maxConcurrentCalls','contentRetentionDays'];
  if (Object.keys(raw).some(key => !allowed.includes(key))) fail('Konfiguracja zawiera nieznane klucze.');
  const client = { ...raw };
  for (const [key, max] of [['clientId',60],['companyName',150],['greeting',800],['processDescription',1500],['language',10],['voice',80]]) client[key] = text(client[key], key, max);
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(client.clientId)) fail('clientId: małe litery, cyfry i myślnik; 2–60 znaków.');
  if (client.language !== 'pl-PL' || !/^[A-Za-z0-9.-]+$/.test(client.voice)) fail('Starter obsługuje język pl-PL i nazwę głosu bez znaków XML.');
  if (!Array.isArray(client.fields) || client.fields.length < 1 || client.fields.length > 6) fail('Potrzeba od 1 do 6 pól zgłoszenia.');
  const seen = new Set();
  client.fields = client.fields.map(field => {
    if (!field || Object.keys(field).some(key => !['key','label','question','required','maxLength'].includes(key))) fail('Nieprawidłowe pole formularza.');
    const key = text(field.key, 'fields.key', 32);
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(key) || ['__proto__','constructor','prototype'].includes(key) || seen.has(key)) fail('Klucze pól muszą być unikalne i bezpieczne.');
    seen.add(key);
    if (typeof field.required !== 'boolean' || !Number.isSafeInteger(field.maxLength) || field.maxLength < 1 || field.maxLength > 1000) fail('Nieprawidłowe required/maxLength pola.');
    return { key, label:text(field.label,'fields.label',100), question:text(field.question,'fields.question',400), required:field.required, maxLength:field.maxLength };
  });
  if (!Array.isArray(client.faq) || client.faq.length > 20) fail('FAQ: maksymalnie 20 odpowiedzi.');
  client.faq = client.faq.map(item => ({ question:text(item?.question,'faq.question',400), answer:text(item?.answer,'faq.answer',800) }));
  for (const [key, min, max] of [['monthlyMinutes',5,100000],['maxCallSeconds',30,300],['maxTurns',4,20],['maxConcurrentCalls',1,1],['contentRetentionDays',1,30]]) {
    if (!Number.isSafeInteger(client[key]) || client[key] < min || client[key] > max) fail(`Nieprawidłowa granica ${key}: ${min}–${max}.`);
  }
  return client;
}
function parsePeriod(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value || '')) fail(`${label}: podaj pełny ISO czas ze strefą Z lub offsetem.`);
  const timestamp = Date.parse(value); if (!Number.isFinite(timestamp)) fail(`Nieprawidłowy ${label}.`); return timestamp;
}
function loadSettings(env = process.env, cwd = process.cwd()) {
  if (Number(process.versions.node.split('.')[0]) < 24 || (Number(process.versions.node.split('.')[0]) === 24 && Number(process.versions.node.split('.')[1]) < 19)) fail('Wymagany Node.js 24.19 lub nowszy.');
  let raw;
  try { raw = JSON.parse(env.CLIENT_CONFIG_JSON?.trim() || fs.readFileSync(path.resolve(cwd, env.CLIENT_CONFIG || 'config/client.json'),'utf8')); }
  catch { fail('Brak poprawnej konfiguracji klienta. Lokalnie: npm run init. Railway: ustaw CLIENT_CONFIG_JSON.'); }
  const client = validateClient(raw);
  const mode = env.BOT_MODE || 'demo'; if (!['demo','live'].includes(mode)) fail('BOT_MODE musi być demo albo live.');
  const port = Number(env.PORT || 3001); if (!Number.isInteger(port) || port < 0 || port > 65535) fail('Nieprawidłowy PORT.');
  const settings = {
    mode, port, dataDir:path.resolve(cwd,env.DATA_DIR || './data'), publicBaseUrl:env.PUBLIC_BASE_URL?.replace(/\/$/,'') || '',
    allowLiveCalls:env.ALLOW_LIVE_CALLS === 'true', liveTestOnly:env.LIVE_TEST_ONLY !== 'false',
    allowedCallers:(env.ALLOWED_CALLERS || '').split(',').map(s=>s.trim()).filter(Boolean),
    twilioAccountSid:env.TWILIO_ACCOUNT_SID || '',twilioAuthToken:env.TWILIO_AUTH_TOKEN || '',twilioPhoneNumber:env.TWILIO_PHONE_NUMBER || '',
    openaiApiKey:env.OPENAI_API_KEY || '',openaiModel:env.OPENAI_MODEL || 'gpt-4.1-mini',telegramBotToken:env.TELEGRAM_BOT_TOKEN || '',telegramChatId:env.TELEGRAM_CHAT_ID || '',
    clientFingerprint:crypto.createHash('sha256').update(JSON.stringify([client.clientId,client.companyName])).digest('hex'),
    configHash:crypto.createHash('sha256').update(JSON.stringify(client)).digest('hex'),
  };
  const now = Date.now();
  if (mode === 'live') {
    if (!settings.allowLiveCalls) fail('Tryb live wymaga ALLOW_LIVE_CALLS=true po sprawdzeniu instrukcji i kosztów.');
    let url; try { url = new URL(settings.publicBaseUrl); } catch { fail('PUBLIC_BASE_URL musi być poprawnym adresem HTTPS usługi.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail('PUBLIC_BASE_URL: HTTPS, bez ścieżki, sekretu i zapytania.');
    if (!/^AC[a-f0-9]{32}$/i.test(settings.twilioAccountSid) || settings.twilioAuthToken.length < 16 || !/^\+[1-9]\d{7,14}$/.test(settings.twilioPhoneNumber)) fail('Uzupełnij prawidłowe dane Twilio.');
    if (settings.openaiApiKey.length < 16 || settings.telegramBotToken.length < 20 || !/^-?\d+$/.test(settings.telegramChatId)) fail('Uzupełnij dane OpenAI oraz Telegram.');
    if (settings.allowedCallers.some(number=>!/^\+[1-9]\d{7,14}$/.test(number)) || (settings.liveTestOnly && settings.allowedCallers.length===0)) fail('Test live wymaga ALLOWED_CALLERS w formacie E.164.');
    settings.periodStart = parsePeriod(env.BILLING_PERIOD_START,'BILLING_PERIOD_START');
    settings.periodEnd = parsePeriod(env.BILLING_PERIOD_END,'BILLING_PERIOD_END');
    if (settings.periodStart >= settings.periodEnd || settings.periodEnd-settings.periodStart>40*86400000) fail('Okres musi trwać od ponad 0 do 40 dni.');
  } else {
    settings.periodStart = env.BILLING_PERIOD_START ? parsePeriod(env.BILLING_PERIOD_START,'BILLING_PERIOD_START') : Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth(),1);
    settings.periodEnd = env.BILLING_PERIOD_END ? parsePeriod(env.BILLING_PERIOD_END,'BILLING_PERIOD_END') : settings.periodStart+32*86400000;
  }
  return { settings, client };
}
module.exports = { validateClient, loadSettings, parsePeriod };
