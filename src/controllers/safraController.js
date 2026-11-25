const Safra = require('../models/Safra');
const Previsao = require('../models/Previsao');
const Dispositivo = require('../models/Dispositivo');
const previsaoService = require('../services/previsaoService');
const { bloquear } = require('../middlewares/dono');

exports.criar = async (req, res, next) => {
  try {
    // Só campos permitidos; donoId vem do token (o corpo não pode definir dono nem status)
    const { nome, variedade, grausDiaColheita, areaHa, dataPoda, produtividadeBaseKgHa, canalId } = req.body;
    // Não dá para ligar a safra ao canal de outro usuário
    if (canalId && !(await Dispositivo.exists({ canalId: String(canalId), donoId: req.usuario.id }))) {
      return bloquear(req, res, 'canal', canalId);
    }
    const safra = await Safra.create({
      nome, variedade, grausDiaColheita, areaHa, dataPoda, produtividadeBaseKgHa, canalId, donoId: req.usuario.id,
    });
    res.status(201).json(safra);
  } catch (err) {
    if (err.name === 'ValidationError') err.status = 400;
    next(err);
  }
};

exports.listar = async (req, res, next) => {
  try {
    const filtro = { donoId: req.usuario.id };
    if (typeof req.query.status === 'string') filtro.status = req.query.status;
    res.json(await Safra.find(filtro).sort({ dataPoda: -1 }));
  } catch (err) { next(err); }
};

exports.buscar = async (req, res, next) => {
  try {
    res.json(req.safra); // já conferida por safraDoDono
  } catch (err) { next(err); }
};

exports.encerrar = async (req, res, next) => {
  try {
    const { colheitaRealKg } = req.body;
    if (typeof colheitaRealKg !== 'number' || colheitaRealKg < 0) {
      return res.status(400).json({ erro: 'Informe colheitaRealKg (número >= 0)' });
    }
    const safra = await Safra.findOneAndUpdate(
      { _id: req.params.id, donoId: req.usuario.id }, // dono conferido também na escrita
      { status: 'encerrada', colheitaRealKg, encerradaEm: new Date() },
      { new: true }
    );
    if (!safra) return res.status(404).json({ erro: 'Safra não encontrada' });
    res.json(safra);
  } catch (err) { next(err); }
};

exports.previsao = async (req, res, next) => {
  try {
    res.json(await previsaoService.calcularPrevisao(req.params.id, req.usuario.id, { persistir: true }));
  } catch (err) { next(err); }
};

exports.historicoPrevisoes = async (req, res, next) => {
  try {
    res.json(await Previsao.find({ safraId: req.safra._id }).sort({ calculadaEm: 1 }));
  } catch (err) { next(err); }
};

exports.previsaoPeriodo = async (req, res, next) => {
  try {
    const inicio = new Date(req.query.inicio);
    const fim = new Date(req.query.fim);
    if (Number.isNaN(inicio) || Number.isNaN(fim)) {
      return res.status(400).json({ erro: 'Use ?inicio=AAAA-MM-DD&fim=AAAA-MM-DD' });
    }
    res.json(await previsaoService.previsaoPorPeriodo(inicio, fim, req.usuario.id));
  } catch (err) { next(err); }
};
