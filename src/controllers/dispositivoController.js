const Dispositivo = require('../models/Dispositivo');
const log = require('../seguranca/log');

exports.criar = async (req, res, next) => {
  try {
    const { nome, canalId, intervaloSegundos } = req.body;
    // donoId vem do token. Qualquer donoId enviado no corpo é ignorado.
    const dispositivo = await Dispositivo.create({ nome, canalId, intervaloSegundos, donoId: req.usuario.id });
    log.registrar('DISPOSITIVO_CRIADO', { usuario: req.usuario.id, dispositivo: String(dispositivo._id) });
    res.status(201).json(dispositivo);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Canal já cadastrado' });
    if (err.name === 'ValidationError') err.status = 400;
    next(err);
  }
};

exports.listar = async (req, res, next) => {
  try {
    res.json(await Dispositivo.find({ donoId: req.usuario.id }).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
};

exports.buscar = (req, res) => res.json(req.dispositivo);

// Altera a configuração (nome e intervalo). O canalId não muda depois de criado.
exports.alterar = async (req, res, next) => {
  try {
    const { nome, intervaloSegundos } = req.body;
    if (nome !== undefined) req.dispositivo.nome = nome;
    if (intervaloSegundos !== undefined) req.dispositivo.intervaloSegundos = intervaloSegundos;
    res.json(await req.dispositivo.save());
  } catch (err) {
    if (err.name === 'ValidationError') err.status = 400;
    next(err);
  }
};

// Comando ao dispositivo: por enquanto só é registrado (ainda não vai para o MQTT)
exports.comandar = async (req, res, next) => {
  try {
    const { comando } = req.body;
    if (typeof comando !== 'string' || !comando.trim()) {
      return res.status(400).json({ erro: 'Informe o comando' });
    }
    req.dispositivo.comandos.push({ comando: comando.trim() });
    await req.dispositivo.save();
    log.registrar('COMANDO_REGISTRADO', { usuario: req.usuario.id, dispositivo: String(req.dispositivo._id) });
    res.status(202).json({ aceito: true, comando: comando.trim() });
  } catch (err) { next(err); }
};
