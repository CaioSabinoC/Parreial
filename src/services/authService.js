const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const Usuario = require('../models/Usuario');
const config = require('../config/env');
const cripto = require('../seguranca/cripto');
const totp = require('../seguranca/totp');
const log = require('../seguranca/log');

const S = () => config.seguranca;

function erro(status, mensagem) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

// Tokens: "parcial" (senha ok, falta o OTP) NÃO acessa a API. Só "acesso" acessa.
function emitirToken(usuario, tipo) {
  const minutos = tipo === 'acesso' ? S().tokenAcessoMin : S().tokenParcialMin;
  return jwt.sign({ sub: String(usuario._id), tipo }, S().jwtSecret, { algorithm: 'HS256', expiresIn: `${minutos}m` });
}

function validarEmailSenha(email, senha) {
  // typeof evita injeção de operador do Mongo (ex.: {"email": {"$ne": null}})
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw erro(400, 'E-mail inválido');
  if (typeof senha !== 'string' || senha.length < 8) throw erro(400, 'A senha precisa ter ao menos 8 caracteres');
}

async function dadosQr(usuario) {
  const segredo = cripto.decifrar(usuario.otpSegredoCifrado);
  const otpauthUrl = totp.urlOtpauth(segredo, usuario.email, S().otpEmissor);
  return { otpauthUrl, qrCode: await QRCode.toDataURL(otpauthUrl) };
}

function estaBloqueado(usuario) {
  return usuario.bloqueadoAte && usuario.bloqueadoAte > new Date();
}

async function registrarFalha(usuario, motivo) {
  const falhas = usuario.falhasSeguidas + 1;
  const atualizacao = { falhasSeguidas: falhas };
  if (falhas >= S().maxFalhas) {
    atualizacao.bloqueadoAte = new Date(Date.now() + S().bloqueioMin * 60 * 1000);
    atualizacao.falhasSeguidas = 0;
    log.registrar('CONTA_BLOQUEADA', { usuario: String(usuario._id), minutos: S().bloqueioMin });
  }
  await Usuario.updateOne({ _id: usuario._id }, atualizacao);
  log.registrar('FALHA_AUTENTICACAO', { usuario: String(usuario._id), motivo, falhas });
}

async function registrar(email, senha) {
  validarEmailSenha(email, senha);
  try {
    const usuario = await Usuario.create({
      email,
      senhaHash: cripto.hashSenha(senha),
      otpSegredoCifrado: cripto.cifrar(totp.gerarSegredo()),
    });
    log.registrar('USUARIO_CRIADO', { usuario: String(usuario._id) });
    return { etapa: 'configurar-otp', tokenParcial: emitirToken(usuario, 'parcial'), ...(await dadosQr(usuario)) };
  } catch (err) {
    if (err.code === 11000) throw erro(409, 'E-mail já cadastrado');
    throw err;
  }
}

// Etapa 1: confere a senha. Não libera acesso à API.
async function login(email, senha) {
  validarEmailSenha(email, senha);
  const usuario = await Usuario.findOne({ email: email.toLowerCase().trim() });
  if (!usuario) throw erro(401, 'Credenciais inválidas');
  if (estaBloqueado(usuario)) throw erro(423, 'Conta temporariamente bloqueada. Tente mais tarde');

  if (!cripto.conferirSenha(senha, usuario.senhaHash)) {
    await registrarFalha(usuario, 'senha');
    throw erro(401, 'Credenciais inválidas');
  }

  log.registrar('LOGIN_SENHA_OK', { usuario: String(usuario._id), otpAtivo: usuario.otpAtivo });
  const tokenParcial = emitirToken(usuario, 'parcial');
  if (usuario.otpAtivo) return { etapa: 'otp', tokenParcial };
  return { etapa: 'configurar-otp', tokenParcial, ...(await dadosQr(usuario)) };
}

// Confere o código TOTP e consome o passo (anti-reuso, atômico)
async function consumirTotp(usuario, codigo) {
  const segredo = cripto.decifrar(usuario.otpSegredoCifrado);
  const passo = totp.verificar(segredo, codigo, { janela: S().otpJanela });
  if (passo === null) return false;
  const r = await Usuario.updateOne({ _id: usuario._id, otpUltimoPasso: { $lt: passo } }, { otpUltimoPasso: passo });
  return r.modifiedCount === 1; // 0 = esse código (ou um mais novo) já foi usado
}

// Código de recuperação: vale uma vez ($pull atômico)
async function consumirRecuperacao(usuario, codigo) {
  if (typeof codigo !== 'string') return false;
  const hash = cripto.hashCodigo(codigo);
  const r = await Usuario.updateOne({ _id: usuario._id, codigosRecuperacao: hash }, { $pull: { codigosRecuperacao: hash } });
  return r.modifiedCount === 1;
}

async function carregar(id) {
  const usuario = await Usuario.findById(id);
  if (!usuario) throw erro(401, 'Token inválido');
  return usuario;
}

function novosCodigosRecuperacao() {
  const codigos = Array.from({ length: 10 }, () => cripto.gerarCodigoRecuperacao());
  return { codigos, hashes: codigos.map(cripto.hashCodigo) };
}

// Primeiro acesso: confirma que o app autenticador foi configurado
async function confirmarOtp(usuarioId, codigo) {
  const usuario = await carregar(usuarioId);
  if (usuario.otpAtivo) throw erro(409, 'OTP já está ativo');
  if (estaBloqueado(usuario)) throw erro(423, 'Conta temporariamente bloqueada. Tente mais tarde');

  if (!(await consumirTotp(usuario, codigo))) {
    await registrarFalha(usuario, 'otp-confirmacao');
    throw erro(401, 'Código inválido');
  }
  const { codigos, hashes } = novosCodigosRecuperacao();
  await Usuario.updateOne({ _id: usuario._id }, { otpAtivo: true, codigosRecuperacao: hashes, falhasSeguidas: 0 });
  log.registrar('OTP_ATIVADO', { usuario: String(usuario._id) });
  return { tokenAcesso: emitirToken(usuario, 'acesso'), codigosRecuperacao: codigos };
}

// Etapa 2: só aqui sai o token de acesso
async function verificarOtp(usuarioId, { codigo, codigoRecuperacao }) {
  const usuario = await carregar(usuarioId);
  if (!usuario.otpAtivo) throw erro(409, 'Configure o OTP primeiro');
  if (estaBloqueado(usuario)) throw erro(423, 'Conta temporariamente bloqueada. Tente mais tarde');

  let ok = false;
  let via = 'otp';
  if (codigoRecuperacao !== undefined) {
    via = 'recuperacao';
    ok = await consumirRecuperacao(usuario, codigoRecuperacao);
  } else {
    ok = await consumirTotp(usuario, codigo);
  }

  if (!ok) {
    await registrarFalha(usuario, via);
    throw erro(401, 'Código inválido');
  }
  await Usuario.updateOne({ _id: usuario._id }, { falhasSeguidas: 0 });
  log.registrar('LOGIN_COMPLETO', { usuario: String(usuario._id), via });
  return { tokenAcesso: emitirToken(usuario, 'acesso') };
}

// Rota extra: gera 10 códigos novos (os antigos deixam de valer). Exige um código OTP atual.
async function regenerarRecuperacao(usuarioId, codigo) {
  const usuario = await carregar(usuarioId);
  if (estaBloqueado(usuario)) throw erro(423, 'Conta temporariamente bloqueada. Tente mais tarde');
  if (!(await consumirTotp(usuario, codigo))) {
    await registrarFalha(usuario, 'regenerar-recuperacao');
    throw erro(401, 'Código inválido');
  }
  const { codigos, hashes } = novosCodigosRecuperacao();
  await Usuario.updateOne({ _id: usuario._id }, { codigosRecuperacao: hashes, falhasSeguidas: 0 });
  log.registrar('RECUPERACAO_REGENERADA', { usuario: String(usuario._id) });
  return { codigosRecuperacao: codigos };
}

module.exports = { registrar, login, confirmarOtp, verificarOtp, regenerarRecuperacao };
