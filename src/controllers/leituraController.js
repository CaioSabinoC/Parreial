const leituraService = require('../services/leituraService');

const MS_DIA = 24 * 60 * 60 * 1000;

exports.listar = async (req, res, next) => {
  try {
    const fim = req.query.fim ? new Date(req.query.fim) : new Date();
    const inicio = req.query.inicio ? new Date(req.query.inicio) : new Date(fim.getTime() - MS_DIA);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      return res.status(400).json({ erro: 'Datas inválidas. Use AAAA-MM-DD ou ISO 8601' });
    }
    const limite = Math.min(Math.max(Number(req.query.limite) || 500, 1), 5000);
    res.json(await leituraService.listar({ inicio, fim, canalId: req.query.canalId, limite }));
  } catch (err) { next(err); }
};

exports.ultima = async (req, res, next) => {
  try {
    const leitura = await leituraService.ultima(req.query.canalId);
    if (!leitura) return res.status(404).json({ erro: 'Nenhuma leitura encontrada' });
    res.json(leitura);
  } catch (err) { next(err); }
};

exports.resumo = async (req, res, next) => {
  try {
    const periodo = req.query.periodo === 'semana' ? 'semana' : 'dia';
    res.json(await leituraService.resumo(periodo, req.query.canalId));
  } catch (err) { next(err); }
};
