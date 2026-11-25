process.env.OTP_CHAVE = 'a'.repeat(64);

const test = require('node:test');
const assert = require('node:assert');
const cripto = require('../src/seguranca/cripto');

test('segredo cifrado volta igual e não aparece em claro', () => {
  const cifrado = cripto.cifrar('JBSWY3DPEHPK3PXP');
  assert.ok(!cifrado.includes('JBSWY3DPEHPK3PXP'));
  assert.strictEqual(cripto.decifrar(cifrado), 'JBSWY3DPEHPK3PXP');
});

test('dado cifrado adulterado é rejeitado', () => {
  const [iv, tag, dados] = cripto.cifrar('segredo').split('.');
  const adulterado = [iv, tag, Buffer.from('xxxxxxx').toString('base64')].join('.');
  assert.throws(() => cripto.decifrar(adulterado));
  assert.ok(dados);
});

test('senha: hash confere só com a senha certa e usa sal', () => {
  const h1 = cripto.hashSenha('minha-senha-123');
  assert.ok(cripto.conferirSenha('minha-senha-123', h1));
  assert.ok(!cripto.conferirSenha('outra-senha', h1));
  assert.notStrictEqual(h1, cripto.hashSenha('minha-senha-123'));
});

test('código de recuperação: formato e hash ignora maiúsculas e hífen', () => {
  const c = cripto.gerarCodigoRecuperacao();
  assert.match(c, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assert.strictEqual(cripto.hashCodigo(c), cripto.hashCodigo(c.toLowerCase().replace('-', '')));
});
