const Safra = require('../models/Safra');
const Previsao = require('../models/Previsao');
const previsaoService = require('../services/previsaoService');

exports.criar = async (req, res, next) => {
  try {
    const safra = await Safra.create(req.body);
    res.status(201).json(safra);
  } catch (err) {
    if (err.name === 'ValidationError') err.status = 400;
    next(err);
  }
};

exports.listar = async (req, res, next) => {
  try {
    const filtro = req.query.status ? { status: req.query.status } : {};
    res.json(await Safra.find(filtro).sort({ dataPoda: -1 }));
  } catch (err) { next(err); }
};

exports.buscar = async (req, res, next) => {
  try {
    const safra = await Safra.findById(req.params.id);
    if (!safra) return res.status(404).json({ erro: 'Safra não encontrada' });
    res.json(safra);
  } catch (err) { next(err); }
};

exports.encerrar = async (req, res, next) => {
  try {
    const { colheitaRealKg } = req.body;
    if (typeof colheitaRealKg !== 'number' || colheitaRealKg < 0) {
      return res.status(400).json({ erro: 'Informe colheitaRealKg (número >= 0)' });
    }
    const safra = await Safra.findByIdAndUpdate(
      req.params.id,
      { status: 'encerrada', colheitaRealKg, encerradaEm: new Date() },
      { new: true }
    );
    if (!safra) return res.status(404).json({ erro: 'Safra não encontrada' });
    res.json(safra);
  } catch (err) { next(err); }
};

exports.previsao = async (req, res, next) => {
  try {
    res.json(await previsaoService.calcularPrevisao(req.params.id, { persistir: true }));
  } catch (err) { next(err); }
};

exports.historicoPrevisoes = async (req, res, next) => {
  try {
    res.json(await Previsao.find({ safraId: req.params.id }).sort({ calculadaEm: 1 }));
  } catch (err) { next(err); }
};

exports.previsaoPeriodo = async (req, res, next) => {
  try {
    const inicio = new Date(req.query.inicio);
    const fim = new Date(req.query.fim);
    if (Number.isNaN(inicio) || Number.isNaN(fim)) {
      return res.status(400).json({ erro: 'Use ?inicio=AAAA-MM-DD&fim=AAAA-MM-DD' });
    }
    res.json(await previsaoService.previsaoPorPeriodo(inicio, fim));
  } catch (err) { next(err); }
};
