// Testes de integração dos dois controles (OTP e IDOR) com MongoDB de verdade.
// Usa um banco SEPARADO (nome terminando em "teste"), apagado a cada execução.
// MONGODB_URI_TESTE se existir; senão usa o MONGODB_URI trocando o nome do banco por parreiral_teste.
require('dotenv').config({ quiet: true });

function uriDeTeste() {
  if (process.env.MONGODB_URI_TESTE) return process.env.MONGODB_URI_TESTE;
  const base = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/parreiral';
  const url = new URL(base);
  url.pathname = '/parreiral_teste';
  return url.toString();
}

process.env.CODIGO_MISSAO = process.env.CODIGO_MISSAO || 'TESTE1';
process.env.JWT_SECRET = 'jwt-secret-so-para-teste-com-mais-de-32-caracteres';
process.env.OTP_CHAVE = 'b'.repeat(64);
process.env.OTP_JANELA = '10'; // folga para o teste pedir vários códigos seguidos (cada código só vale uma vez)
process.env.MAX_FALHAS = '5';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const app = require('../src/app');
const totp = require('../src/seguranca/totp');
const Leitura = require('../src/models/Leitura');
const Dispositivo = require('../src/models/Dispositivo');
const Safra = require('../src/models/Safra');

let servidor;
let base;
const offsets = new Map(); // segredo -> quantos códigos já pedimos

test.before(async () => {
  const uri = uriDeTeste();
  const nome = new URL(uri).pathname.replace('/', '');
  assert.match(nome, /teste$/i, `Por segurança, o banco de teste precisa terminar em "teste" (veio: "${nome}")`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await Promise.all(mongoose.modelNames().map((m) => mongoose.model(m).init()));
  servidor = app.listen(0);
  base = `http://127.0.0.1:${servidor.address().port}`;
});

test.after(async () => {
  servidor.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function chamar(metodo, caminho, corpo, token) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  let json = null;
  try { json = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, corpo: json };
}

const segredoDaUrl = (url) => new URL(url).searchParams.get('secret');

// Gera um código válido que ainda não foi usado para esse segredo
function proximoCodigo(segredo) {
  const n = offsets.get(segredo) ?? 0;
  offsets.set(segredo, n + 1);
  return totp.codigoDoPasso(segredo, totp.passoDe() + n);
}

async function novoUsuario(email) {
  const reg = await chamar('POST', '/auth/registrar', { email, senha: 'senha-forte-123' });
  assert.strictEqual(reg.status, 201);
  const segredo = segredoDaUrl(reg.corpo.otpauthUrl);
  const conf = await chamar('POST', '/auth/otp/confirmar', { codigo: proximoCodigo(segredo) }, reg.corpo.tokenParcial);
  assert.strictEqual(conf.status, 200);
  return { email, segredo, token: conf.corpo.tokenAcesso, recuperacao: conf.corpo.codigosRecuperacao };
}

async function loginCompleto(u) {
  const l = await chamar('POST', '/auth/login', { email: u.email, senha: 'senha-forte-123' });
  const v = await chamar('POST', '/auth/otp/verificar', { codigo: proximoCodigo(u.segredo) }, l.corpo.tokenParcial);
  return { login: l, verificacao: v };
}

// ============================ OTP ============================
test('OTP: API exige login (sem token = 401)', async () => {
  for (const rota of ['/safras', '/leituras', '/dispositivos', '/leituras/ultima']) {
    assert.strictEqual((await chamar('GET', rota)).status, 401, rota);
  }
});

test('OTP: cadastro devolve QR e o segredo não fica em claro no banco', async () => {
  const reg = await chamar('POST', '/auth/registrar', { email: 'qr@teste.com', senha: 'senha-forte-123' });
  assert.strictEqual(reg.status, 201);
  assert.ok(reg.corpo.qrCode.startsWith('data:image/png;base64,'));
  const segredo = segredoDaUrl(reg.corpo.otpauthUrl);
  const Usuario = require('../src/models/Usuario');
  const u = await Usuario.findOne({ email: 'qr@teste.com' }).lean();
  assert.ok(!JSON.stringify(u).includes(segredo));
});

test('OTP: senha certa devolve só token parcial, que NÃO acessa a API', async () => {
  const u = await novoUsuario('parcial@teste.com');
  const l = await chamar('POST', '/auth/login', { email: u.email, senha: 'senha-forte-123' });
  assert.strictEqual(l.status, 200);
  assert.strictEqual(l.corpo.etapa, 'otp');
  assert.ok(!l.corpo.tokenAcesso);
  assert.strictEqual((await chamar('GET', '/safras', undefined, l.corpo.tokenParcial)).status, 401);
});

test('OTP: senha errada = 401 e código errado = 401; código certo libera', async () => {
  const u = await novoUsuario('fluxo@teste.com');
  assert.strictEqual((await chamar('POST', '/auth/login', { email: u.email, senha: 'errada-errada' })).status, 401);

  const l = await chamar('POST', '/auth/login', { email: u.email, senha: 'senha-forte-123' });
  const ruim = await chamar('POST', '/auth/otp/verificar', { codigo: '000000' }, l.corpo.tokenParcial);
  assert.strictEqual(ruim.status, 401);

  const bom = await chamar('POST', '/auth/otp/verificar', { codigo: proximoCodigo(u.segredo) }, l.corpo.tokenParcial);
  assert.strictEqual(bom.status, 200);
  assert.strictEqual((await chamar('GET', '/safras', undefined, bom.corpo.tokenAcesso)).status, 200);
});

test('OTP: o mesmo código não vale duas vezes (anti-reuso)', async () => {
  const u = await novoUsuario('reuso@teste.com');
  const codigo = proximoCodigo(u.segredo);
  const l1 = await chamar('POST', '/auth/login', { email: u.email, senha: 'senha-forte-123' });
  assert.strictEqual((await chamar('POST', '/auth/otp/verificar', { codigo }, l1.corpo.tokenParcial)).status, 200);
  const l2 = await chamar('POST', '/auth/login', { email: u.email, senha: 'senha-forte-123' });
  assert.strictEqual((await chamar('POST', '/auth/otp/verificar', { codigo }, l2.corpo.tokenParcial)).status, 401);
});

test('OTP: código de recuperação funciona uma única vez', async () => {
  const u = await novoUsuario('recupera@teste.com');
  assert.strictEqual(u.recuperacao.length, 10);
  const codigo = u.recuperacao[0];

  const l1 = await chamar('POST', '/auth/login', { email: u.email, senha: 'senha-forte-123' });
  const r1 = await chamar('POST', '/auth/otp/verificar', { codigoRecuperacao: codigo }, l1.corpo.tokenParcial);
  assert.strictEqual(r1.status, 200);

  const l2 = await chamar('POST', '/auth/login', { email: u.email, senha: 'senha-forte-123' });
  const r2 = await chamar('POST', '/auth/otp/verificar', { codigoRecuperacao: codigo }, l2.corpo.tokenParcial);
  assert.strictEqual(r2.status, 401);
});

test('OTP: 5 erros seguidos bloqueiam a conta (mesmo com o código certo depois)', async () => {
  const u = await novoUsuario('forca@teste.com');
  const l = await chamar('POST', '/auth/login', { email: u.email, senha: 'senha-forte-123' });
  for (let i = 0; i < 5; i++) {
    assert.strictEqual((await chamar('POST', '/auth/otp/verificar', { codigo: '111111' }, l.corpo.tokenParcial)).status, 401);
  }
  const certo = await chamar('POST', '/auth/otp/verificar', { codigo: proximoCodigo(u.segredo) }, l.corpo.tokenParcial);
  assert.strictEqual(certo.status, 423);
  const login = await chamar('POST', '/auth/login', { email: u.email, senha: 'senha-forte-123' });
  assert.strictEqual(login.status, 423);
});

test('OTP: regenerar códigos de recuperação exige código OTP e invalida os antigos', async () => {
  const u = await novoUsuario('regenera@teste.com');
  assert.strictEqual((await chamar('POST', '/auth/recuperacao/regenerar', { codigo: '000000' }, u.token)).status, 401);
  assert.strictEqual((await chamar('POST', '/auth/recuperacao/regenerar', { codigo: proximoCodigo(u.segredo) })).status, 401); // sem token

  const novos = await chamar('POST', '/auth/recuperacao/regenerar', { codigo: proximoCodigo(u.segredo) }, u.token);
  assert.strictEqual(novos.status, 200);
  assert.strictEqual(novos.corpo.codigosRecuperacao.length, 10);

  const l = await chamar('POST', '/auth/login', { email: u.email, senha: 'senha-forte-123' });
  const antigo = await chamar('POST', '/auth/otp/verificar', { codigoRecuperacao: u.recuperacao[1] }, l.corpo.tokenParcial);
  assert.strictEqual(antigo.status, 401);
  const novo = await chamar('POST', '/auth/otp/verificar', { codigoRecuperacao: novos.corpo.codigosRecuperacao[0] }, l.corpo.tokenParcial);
  assert.strictEqual(novo.status, 200);
});

test('OTP: e-mail como objeto (injeção NoSQL) é rejeitado', async () => {
  const r = await chamar('POST', '/auth/login', { email: { $ne: null }, senha: 'senha-forte-123' });
  assert.strictEqual(r.status, 400);
});

// ============================ IDOR ============================
const ctx = {};

test('IDOR: preparação (A e B com dispositivo, safra e leitura)', async () => {
  ctx.a = await novoUsuario('a@teste.com');
  ctx.b = await novoUsuario('b@teste.com');

  const dA = await chamar('POST', '/dispositivos', { nome: 'Sensor A', canalId: 'canal-A' }, ctx.a.token);
  const dB = await chamar('POST', '/dispositivos', { nome: 'Sensor B', canalId: 'canal-B' }, ctx.b.token);
  assert.strictEqual(dA.status, 201);
  assert.strictEqual(dB.status, 201);
  ctx.dA = dA.corpo._id;
  ctx.dB = dB.corpo._id;

  const sA = await chamar('POST', '/safras', { nome: 'Safra A', variedade: 'Syrah', areaHa: 2, dataPoda: '2026-09-01', produtividadeBaseKgHa: 9000, canalId: 'canal-A' }, ctx.a.token);
  const sB = await chamar('POST', '/safras', { nome: 'Safra B', variedade: 'Syrah', areaHa: 1, dataPoda: '2026-09-01', produtividadeBaseKgHa: 9000, canalId: 'canal-B' }, ctx.b.token);
  assert.strictEqual(sA.status, 201);
  assert.strictEqual(sB.status, 201);
  ctx.sA = sA.corpo._id;
  ctx.sB = sB.corpo._id;

  await Leitura.create({ temperatura: 25, umidadeAr: 60, umidadeSolo: 40, canalId: 'canal-A', lidoEm: new Date() });
});

test('IDOR: B não vê, altera nem prevê a safra de A (404)', async () => {
  assert.strictEqual((await chamar('GET', `/safras/${ctx.sA}`, undefined, ctx.b.token)).status, 404);
  assert.strictEqual((await chamar('PATCH', `/safras/${ctx.sA}/encerrar`, { colheitaRealKg: 1 }, ctx.b.token)).status, 404);
  assert.strictEqual((await chamar('GET', `/safras/${ctx.sA}/previsao`, undefined, ctx.b.token)).status, 404);
  assert.strictEqual((await chamar('GET', `/safras/${ctx.sA}/previsoes`, undefined, ctx.b.token)).status, 404);
  const intacta = await Safra.findById(ctx.sA).lean();
  assert.strictEqual(intacta.status, 'ativa'); // B não conseguiu encerrar
});

test('IDOR: B não vê, altera nem comanda o dispositivo de A (404)', async () => {
  assert.strictEqual((await chamar('GET', `/dispositivos/${ctx.dA}`, undefined, ctx.b.token)).status, 404);
  assert.strictEqual((await chamar('PATCH', `/dispositivos/${ctx.dA}`, { nome: 'invadido' }, ctx.b.token)).status, 404);
  assert.strictEqual((await chamar('POST', `/dispositivos/${ctx.dA}/comandos`, { comando: 'desligar' }, ctx.b.token)).status, 404);
  const d = await Dispositivo.findById(ctx.dA).lean();
  assert.strictEqual(d.nome, 'Sensor A');
  assert.strictEqual(d.comandos.length, 0);
});

test('IDOR: B não lê leituras de A (por canalId nem sem filtro)', async () => {
  assert.strictEqual((await chamar('GET', '/leituras?canalId=canal-A', undefined, ctx.b.token)).status, 404);
  assert.strictEqual((await chamar('GET', '/leituras/ultima?canalId=canal-A', undefined, ctx.b.token)).status, 404);
  assert.strictEqual((await chamar('GET', '/leituras/resumo?canalId=canal-A', undefined, ctx.b.token)).status, 404);

  const semFiltro = await chamar('GET', '/leituras', undefined, ctx.b.token);
  assert.deepStrictEqual(semFiltro.corpo, []);
  assert.strictEqual((await chamar('GET', '/leituras/ultima', undefined, ctx.b.token)).status, 404);
  assert.strictEqual((await chamar('GET', '/leituras/resumo', undefined, ctx.b.token)).corpo.total, 0);
});

test('IDOR: listas só trazem o que é do próprio usuário', async () => {
  const safras = await chamar('GET', '/safras', undefined, ctx.b.token);
  assert.deepStrictEqual(safras.corpo.map((s) => s._id), [ctx.sB]);
  const disp = await chamar('GET', '/dispositivos', undefined, ctx.b.token);
  assert.deepStrictEqual(disp.corpo.map((d) => d._id), [ctx.dB]);
  const periodo = await chamar('GET', '/safras/previsao?inicio=2026-01-01&fim=2030-01-01', undefined, ctx.b.token);
  assert.ok(!JSON.stringify(periodo.corpo).includes(ctx.sA));
});

test('IDOR: B não consegue se passar por A no corpo nem ligar safra ao canal de A', async () => {
  const roubo = await chamar('POST', '/safras', { nome: 'Roubo', variedade: 'Syrah', areaHa: 1, dataPoda: '2026-09-01', produtividadeBaseKgHa: 9000, canalId: 'canal-A' }, ctx.b.token);
  assert.strictEqual(roubo.status, 404);

  const falsoDono = await chamar('POST', '/safras', { nome: 'Dono falso', variedade: 'Syrah', areaHa: 1, dataPoda: '2026-09-01', produtividadeBaseKgHa: 9000, donoId: ctx.sA, status: 'encerrada' }, ctx.b.token);
  assert.strictEqual(falsoDono.status, 201);
  const salva = await Safra.findById(falsoDono.corpo._id).lean();
  assert.notStrictEqual(String(salva.donoId), String((await Safra.findById(ctx.sA).lean()).donoId));
  assert.strictEqual(salva.status, 'ativa');

  const canalRepetido = await chamar('POST', '/dispositivos', { nome: 'Clone', canalId: 'canal-A' }, ctx.b.token);
  assert.strictEqual(canalRepetido.status, 409);
});

test('IDOR: safra sem canal de B não usa leituras de A na previsão', async () => {
  const semCanal = await chamar('POST', '/safras', { nome: 'Sem canal', variedade: 'Syrah', areaHa: 1, dataPoda: '2026-11-01', produtividadeBaseKgHa: 9000 }, ctx.b.token);
  const p = await chamar('GET', `/safras/${semCanal.corpo._id}/previsao`, undefined, ctx.b.token);
  assert.strictEqual(p.status, 422); // B não tem leituras; as de A não entram na conta
});

test('IDOR: o dono continua com acesso total (A recebe 200)', async () => {
  assert.strictEqual((await chamar('GET', `/safras/${ctx.sA}`, undefined, ctx.a.token)).status, 200);
  assert.strictEqual((await chamar('GET', `/dispositivos/${ctx.dA}`, undefined, ctx.a.token)).status, 200);
  assert.strictEqual((await chamar('POST', `/dispositivos/${ctx.dA}/comandos`, { comando: 'ligar' }, ctx.a.token)).status, 202);
  const leituras = await chamar('GET', '/leituras?canalId=canal-A', undefined, ctx.a.token);
  assert.strictEqual(leituras.status, 200);
  assert.strictEqual(leituras.corpo.length, 1);
  assert.strictEqual((await chamar('GET', `/safras/${ctx.sA}/previsao`, undefined, ctx.a.token)).status, 200);
});
