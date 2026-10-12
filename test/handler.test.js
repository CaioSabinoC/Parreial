const test = require('node:test');
const assert = require('node:assert');
const { interpretarMensagem } = require('../src/mqtt/handler');

const campos = { temperatura: 1, umidadeAr: 2, umidadeSolo: 3 };
const semCalibracao = { seco: null, molhado: null };

test('interpreta mensagem válida do ThingSpeak', () => {
  const msg = JSON.stringify({
    channel_id: 3493396, created_at: '2027-01-10T12:00:00Z',
    field1: '27.5', field2: '60', field3: '45',
  });
  const r = interpretarMensagem(msg, { campos, soloRaw: semCalibracao });
  assert.strictEqual(r.temperatura, 27.5);
  assert.strictEqual(r.umidadeAr, 60);
  assert.strictEqual(r.umidadeSolo, 45);
  assert.strictEqual(r.canalId, '3493396');
  assert.strictEqual(r.lidoEm.toISOString(), '2027-01-10T12:00:00.000Z');
});

test('descarta NaN e valores fora do intervalo, mantém os válidos', () => {
  const msg = JSON.stringify({ field1: 'nan', field2: '55', field3: '150' });
  const r = interpretarMensagem(msg, { campos, soloRaw: semCalibracao });
  assert.strictEqual(r.temperatura, undefined);
  assert.strictEqual(r.umidadeAr, 55);
  assert.strictEqual(r.umidadeSolo, undefined);
});

test('retorna null para JSON inválido ou sem nenhum campo útil', () => {
  assert.strictEqual(interpretarMensagem('isso não é json', { campos }), null);
  assert.strictEqual(interpretarMensagem(JSON.stringify({ field1: 'abc' }), { campos }), null);
});

test('converte valor bruto do solo em % com calibração', () => {
  const soloRaw = { seco: 3000, molhado: 1000 };
  const meio = interpretarMensagem(JSON.stringify({ field3: '2000' }), { campos, soloRaw });
  assert.strictEqual(meio.umidadeSolo, 50);
  const seco = interpretarMensagem(JSON.stringify({ field3: '3200' }), { campos, soloRaw });
  assert.strictEqual(seco.umidadeSolo, 0); // limitado a 0..100
});
