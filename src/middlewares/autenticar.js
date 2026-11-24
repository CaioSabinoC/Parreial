const jwt = require('jsonwebtoken');
const config = require('../config/env');

function lerToken(req, tipoEsperado) {
  const cabecalho = req.headers.authorization || '';
  const [esquema, token] = cabecalho.split(' ');
  if (esquema !== 'Bearer' || !token) return null;
  try {
    const dados = jwt.verify(token, config.seguranca.jwtSecret, { algorithms: ['HS256'] });
    // O tipo impede usar o token parcial (só senha) como se fosse acesso completo
    return dados.tipo === tipoEsperado ? dados : null;
  } catch {
    return null;
  }
}

function criar(tipo) {
  return (req, res, next) => {
    const dados = lerToken(req, tipo);
    if (!dados) return res.status(401).json({ erro: 'Não autenticado' });
    req.usuario = { id: dados.sub };
    next();
  };
}

module.exports = {
  autenticar: criar('acesso'),          // rotas da API: exige OTP concluído
  exigirTokenParcial: criar('parcial'), // etapa do OTP: exige só a senha conferida
};
