// Teste de ANTES e DEPOIS do controle 2 (IDOR).
//   node seguranca/testes/idor.js --fase=antes    (rode no código ORIGINAL, sem o controle)
//   node seguranca/testes/idor.js --fase=depois   (rode no código com o controle)
// Cria dados sintéticos (safras e dispositivos de teste) no banco apontado pelo .env.
const { fase, saida, verificar, chamar, sufixo, finalizar } = require('./_comum');

const SENHA = 'senha-sintetica-123';
const safraModelo = (nome, canalId) => ({
  nome, variedade: 'Syrah', areaHa: 1, dataPoda: '2026-09-01', produtividadeBaseKgHa: 9000, ...(canalId ? { canalId } : {}),
});

async function antes() {
  saida('=== IDOR / ANTES: a API original não tem dono nos dados ===');
  const a = await chamar('POST', '/safras', safraModelo(`Safra sintética A ${sufixo()}`));
  verificar('"usuário A" cria uma safra (sem login, sem dono)', a.status === 201, `status ${a.status}`);
  const id = a.corpo?._id;

  const lerComoB = await chamar('GET', `/safras/${id}`);
  verificar('"usuário B" lê a safra de A trocando só o ID (vulnerável)', lerComoB.status === 200, `status ${lerComoB.status}`);

  const lista = await chamar('GET', '/safras');
  verificar('"usuário B" lista TODAS as safras de todos (vulnerável)', lista.status === 200 && lista.corpo.some((s) => s._id === id), `${lista.corpo?.length} safras visíveis`);

  const leituras = await chamar('GET', '/leituras?inicio=2000-01-01&limite=5000');
  verificar('GET /leituras sem filtro devolve leituras de qualquer canal (vulnerável)', leituras.status === 200, `${leituras.corpo?.length} leituras visíveis`);

  const alterar = await chamar('PATCH', `/safras/${id}/encerrar`, { colheitaRealKg: 1 });
  verificar('"usuário B" ENCERRA a safra de A (vulnerável)', alterar.status === 200, `status ${alterar.status}`);

  const disp = await chamar('GET', '/dispositivos');
  verificar('não existe controle de dispositivos (rota ausente)', disp.status === 404, `status ${disp.status}`);
  saida('RESULTADO: qualquer um lê e altera dados de qualquer um (comportamento esperado ANTES do controle).');
}

async function depois() {
  const { codigoDoPasso, passoDe } = require('../../src/seguranca/totp');
  const segredoDaUrl = (u) => new URL(u).searchParams.get('secret');

  async function novoUsuario(rotulo) {
    const email = `${rotulo}-${sufixo()}@sintetico.test`;
    const reg = await chamar('POST', '/auth/registrar', { email, senha: SENHA });
    const segredo = segredoDaUrl(reg.corpo.otpauthUrl);
    const conf = await chamar('POST', '/auth/otp/confirmar', { codigo: codigoDoPasso(segredo, passoDe()) }, reg.corpo.tokenParcial);
    return { token: conf.corpo.tokenAcesso };
  }

  saida('=== IDOR / DEPOIS: cada usuário só acessa o que é seu ===');
  const A = await novoUsuario('a');
  const B = await novoUsuario('b');
  const canalA = `sintetico-A-${sufixo()}`;
  const canalB = `sintetico-B-${sufixo()}`;

  const dA = await chamar('POST', '/dispositivos', { nome: 'Sensor A', canalId: canalA }, A.token);
  const dB = await chamar('POST', '/dispositivos', { nome: 'Sensor B', canalId: canalB }, B.token);
  const sA = await chamar('POST', '/safras', safraModelo('Safra A', canalA), A.token);
  const sB = await chamar('POST', '/safras', safraModelo('Safra B', canalB), B.token);
  verificar('A e B criam seus dispositivos e safras', [dA, dB, sA, sB].every((r) => r.status === 201));

  const idSafraA = sA.corpo._id;
  const idDispA = dA.corpo._id;

  verificar('sem token, a safra de A é bloqueada (401)', (await chamar('GET', `/safras/${idSafraA}`)).status === 401);
  verificar('B troca o ID e tenta LER a safra de A -> 404', (await chamar('GET', `/safras/${idSafraA}`, undefined, B.token)).status === 404);
  verificar('B tenta ENCERRAR a safra de A -> 404', (await chamar('PATCH', `/safras/${idSafraA}/encerrar`, { colheitaRealKg: 1 }, B.token)).status === 404);
  verificar('B tenta ver a PREVISÃO da safra de A -> 404', (await chamar('GET', `/safras/${idSafraA}/previsao`, undefined, B.token)).status === 404);
  verificar('B tenta LER o dispositivo de A -> 404', (await chamar('GET', `/dispositivos/${idDispA}`, undefined, B.token)).status === 404);
  verificar('B tenta ALTERAR o dispositivo de A -> 404', (await chamar('PATCH', `/dispositivos/${idDispA}`, { nome: 'invadido' }, B.token)).status === 404);
  verificar('B tenta COMANDAR o dispositivo de A -> 404', (await chamar('POST', `/dispositivos/${idDispA}/comandos`, { comando: 'desligar' }, B.token)).status === 404);
  verificar('B pede as leituras do canal de A -> 404', (await chamar('GET', `/leituras?canalId=${canalA}`, undefined, B.token)).status === 404);

  const lista = await chamar('GET', '/safras', undefined, B.token);
  verificar('B lista safras: só aparece a dele', lista.status === 200 && lista.corpo.length === 1 && lista.corpo[0]._id === sB.corpo._id);

  saida('--- tentativas de contorno ---');
  const roubo = await chamar('POST', '/safras', safraModelo('Roubo', canalA), B.token);
  verificar('B tenta criar safra ligada ao canal de A -> 404', roubo.status === 404);
  const falso = await chamar('POST', '/safras', { ...safraModelo('Dono falso'), donoId: 'A', status: 'encerrada' }, B.token);
  verificar('B manda donoId no corpo: é ignorado (a safra fica de B e ativa)', falso.status === 201 && falso.corpo.status === 'ativa' && falso.corpo.donoId !== undefined);
  const [cab, , assin] = B.token.split('.');
  const payloadA = Buffer.from(JSON.stringify({ sub: '000000000000000000000000', tipo: 'acesso' })).toString('base64url');
  verificar('token adulterado (trocar o dono no payload) -> 401', (await chamar('GET', '/safras', undefined, `${cab}.${payloadA}.${assin}`)).status === 401);

  verificar('o dono (A) continua acessando a própria safra -> 200', (await chamar('GET', `/safras/${idSafraA}`, undefined, A.token)).status === 200);
  verificar('o dono (A) continua acessando o próprio dispositivo -> 200', (await chamar('GET', `/dispositivos/${idDispA}`, undefined, A.token)).status === 200);
  saida('RESULTADO: trocar o ID na requisição não dá acesso a dados de outro usuário (404); o dono tem 200.');
}

(fase === 'antes' ? antes() : depois()).then(() => finalizar('idor'));
