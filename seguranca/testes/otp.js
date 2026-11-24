// Teste de ANTES e DEPOIS do controle 1 (OTP).
//   node seguranca/testes/otp.js --fase=antes    (rode no código ORIGINAL, sem o controle)
//   node seguranca/testes/otp.js --fase=depois   (rode no código com o controle)
const { fase, saida, verificar, chamar, sufixo, finalizar } = require('./_comum');

const SENHA = 'senha-sintetica-123';

async function antes() {
  saida('=== OTP / ANTES: a API original não tem login nem segundo fator ===');
  const login = await chamar('POST', '/auth/login', { email: 'x@sintetico.test', senha: SENHA });
  verificar('a API NÃO tem login (POST /auth/login não existe)', login.status === 404, `status ${login.status}`);

  const semCredencial = await chamar('GET', '/safras');
  verificar('GET /safras SEM nenhuma credencial é aceito (vulnerável)', semCredencial.status === 200, `status ${semCredencial.status}`);
  saida('RESULTADO: qualquer pessoa acessa a API sem senha e sem OTP (comportamento esperado ANTES do controle).');
}

async function depois() {
  const { gerarSegredo, codigoDoPasso, passoDe } = require('../../src/seguranca/totp'); // só existe na versão com o controle
  const janela = Number(process.env.OTP_JANELA ?? 1);
  const usados = new Map();
  const proximoCodigo = (segredo) => {
    const n = usados.get(segredo) ?? 0;
    usados.set(segredo, n + 1);
    return codigoDoPasso(segredo, passoDe() + (janela >= 1 ? n : 0)); // 2º código do mesmo segredo: passo seguinte
  };
  void gerarSegredo;
  const segredoDaUrl = (u) => new URL(u).searchParams.get('secret');
  const entrar = (email) => chamar('POST', '/auth/login', { email, senha: SENHA });

  saida('=== OTP / DEPOIS: login em 2 etapas com app autenticador ===');
  verificar('sem token, GET /safras é bloqueado', (await chamar('GET', '/safras')).status === 401);

  const email = `usuario-${sufixo()}@sintetico.test`;
  const reg = await chamar('POST', '/auth/registrar', { email, senha: SENHA });
  verificar('cadastro devolve QR Code para o app autenticador', reg.status === 201 && String(reg.corpo.qrCode).startsWith('data:image/png'));
  const segredo = segredoDaUrl(reg.corpo.otpauthUrl);

  const conf = await chamar('POST', '/auth/otp/confirmar', { codigo: proximoCodigo(segredo) }, reg.corpo.tokenParcial);
  verificar('primeiro código do app ativa o OTP e entrega 10 códigos de recuperação', conf.status === 200 && conf.corpo.codigosRecuperacao?.length === 10);

  const l1 = await entrar(email);
  verificar('senha certa devolve só a etapa "otp" (sem token de acesso)', l1.status === 200 && l1.corpo.etapa === 'otp' && !l1.corpo.tokenAcesso);
  verificar('TENTATIVA DE CONTORNO: token parcial (só senha) não acessa a API', (await chamar('GET', '/safras', undefined, l1.corpo.tokenParcial)).status === 401);
  verificar('código errado é recusado', (await chamar('POST', '/auth/otp/verificar', { codigo: '000000' }, l1.corpo.tokenParcial)).status === 401);

  const codigo = proximoCodigo(segredo);
  const ok = await chamar('POST', '/auth/otp/verificar', { codigo }, l1.corpo.tokenParcial);
  verificar('código certo libera o acesso', ok.status === 200 && !!ok.corpo.tokenAcesso);
  verificar('com o token de acesso, GET /safras funciona', (await chamar('GET', '/safras', undefined, ok.corpo.tokenAcesso)).status === 200);

  const l2 = await entrar(email);
  verificar('TENTATIVA DE CONTORNO: reutilizar o mesmo código é recusado', (await chamar('POST', '/auth/otp/verificar', { codigo }, l2.corpo.tokenParcial)).status === 401);

  const rec = conf.corpo.codigosRecuperacao[0];
  const l3 = await entrar(email);
  verificar('código de recuperação libera uma vez', (await chamar('POST', '/auth/otp/verificar', { codigoRecuperacao: rec }, l3.corpo.tokenParcial)).status === 200);
  const l4 = await entrar(email);
  verificar('o mesmo código de recuperação não vale de novo', (await chamar('POST', '/auth/otp/verificar', { codigoRecuperacao: rec }, l4.corpo.tokenParcial)).status === 401);

  // Força bruta: 5 erros seguidos bloqueiam a conta
  const emailB = `bruta-${sufixo()}@sintetico.test`;
  const regB = await chamar('POST', '/auth/registrar', { email: emailB, senha: SENHA });
  const segB = segredoDaUrl(regB.corpo.otpauthUrl);
  await chamar('POST', '/auth/otp/confirmar', { codigo: proximoCodigo(segB) }, regB.corpo.tokenParcial);
  const lb = await entrar(emailB);
  for (let i = 0; i < 5; i++) await chamar('POST', '/auth/otp/verificar', { codigo: '111111' }, lb.corpo.tokenParcial);
  const depoisDoBloqueio = await chamar('POST', '/auth/otp/verificar', { codigo: proximoCodigo(segB) }, lb.corpo.tokenParcial);
  verificar('TENTATIVA DE CONTORNO: após 5 erros a conta bloqueia (423), mesmo com código certo', depoisDoBloqueio.status === 423, `status ${depoisDoBloqueio.status}`);
  saida('RESULTADO: o acesso só abre com senha + código válido do app (ou recuperação), e a conferência é no servidor.');
}

(fase === 'antes' ? antes() : depois()).then(() => finalizar('otp'));
