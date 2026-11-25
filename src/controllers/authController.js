const auth = require('../services/authService');

const rota = (fn) => async (req, res, next) => {
  try { res.status(fn.status || 200).json(await fn(req)); } catch (err) { next(err); }
};

const registrar = Object.assign((req) => auth.registrar(req.body.email, req.body.senha), { status: 201 });
const login = (req) => auth.login(req.body.email, req.body.senha);
const confirmarOtp = (req) => auth.confirmarOtp(req.usuario.id, req.body.codigo);
const verificarOtp = (req) => auth.verificarOtp(req.usuario.id, req.body);
const regenerar = (req) => auth.regenerarRecuperacao(req.usuario.id, req.body.codigo);
const eu = (req) => Promise.resolve({ id: req.usuario.id });

module.exports = {
  registrar: rota(registrar),
  login: rota(login),
  confirmarOtp: rota(confirmarOtp),
  verificarOtp: rota(verificarOtp),
  regenerar: rota(regenerar),
  eu: rota(eu),
};
