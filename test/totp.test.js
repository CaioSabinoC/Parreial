const test = require('node:test');
const assert = require('node:assert');
const totp = require('../src/seguranca/totp');

// Vetores oficiais da RFC 6238 (SHA-1, segredo ASCII "12345678901234567890"), últimos 6 dígitos
const SEGREDO_RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const VETORES = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
];

test('TOTP bate com os vetores da RFC 6238', () => {
  for (const [segundos, esperado] of VETORES) {
    assert.strictEqual(totp.codigoDoPasso(SEGREDO_RFC, totp.passoDe(segundos * 1000)), esperado);
  }
});

test('verificar aceita o código do passo atual e dos vizinhos (janela), rejeita fora dela', () => {
  const agora = 1234567890 * 1000;
  const passo = totp.passoDe(agora);
  const atual = totp.codigoDoPasso(SEGREDO_RFC, passo);
  const anterior = totp.codigoDoPasso(SEGREDO_RFC, passo - 1);
  const antigo = totp.codigoDoPasso(SEGREDO_RFC, passo - 3);

  assert.strictEqual(totp.verificar(SEGREDO_RFC, atual, { janela: 1, agoraMs: agora }), passo);
  assert.strictEqual(totp.verificar(SEGREDO_RFC, anterior, { janela: 1, agoraMs: agora }), passo - 1);
  assert.strictEqual(totp.verificar(SEGREDO_RFC, antigo, { janela: 1, agoraMs: agora }), null);
  assert.strictEqual(totp.verificar(SEGREDO_RFC, anterior, { janela: 0, agoraMs: agora }), null);
});

test('verificar rejeita formatos inválidos', () => {
  for (const ruim of [undefined, null, 123456, '12345', '1234567', 'abcdef', { $ne: 1 }]) {
    assert.strictEqual(totp.verificar(SEGREDO_RFC, ruim), null);
  }
});

test('segredo gerado é base32 e a URL do QR tem os parâmetros certos', () => {
  const segredo = totp.gerarSegredo();
  assert.match(segredo, /^[A-Z2-7]{32}$/);
  const url = totp.urlOtpauth(segredo, 'a@b.com', 'Parreiral');
  assert.ok(url.startsWith('otpauth://totp/Parreiral%3Aa%40b.com?secret='));
  assert.ok(url.includes('digits=6') && url.includes('period=30'));
});
