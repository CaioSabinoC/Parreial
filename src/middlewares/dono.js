const Safra = require('../models/Safra');
const Dispositivo = require('../models/Dispositivo');
const log = require('../seguranca/log');

// Tentativa de acessar recurso de outro usuário: responde 404 (não revela que existe) e registra
function bloquear(req, res, recurso, id) {
  log.registrar('IDOR_BLOQUEADO', { usuario: req.usuario.id, recurso, id: String(id), rota: `${req.method} ${req.originalUrl.split('?')[0]}` });
  return res.status(404).json({ erro: 'Recurso não encontrado' });
}

// A verificação de dono é no servidor, na própria consulta: {_id, donoId}.
// O donoId vem do token (req.usuario), nunca do corpo ou da URL.
async function safraDoDono(req, res, next) {
  try {
    const safra = await Safra.findOne({ _id: req.params.id, donoId: req.usuario.id });
    if (!safra) return bloquear(req, res, 'safra', req.params.id);
    req.safra = safra;
    next();
  } catch (err) { next(err); }
}

async function dispositivoDoDono(req, res, next) {
  try {
    const dispositivo = await Dispositivo.findOne({ _id: req.params.id, donoId: req.usuario.id });
    if (!dispositivo) return bloquear(req, res, 'dispositivo', req.params.id);
    req.dispositivo = dispositivo;
    next();
  } catch (err) { next(err); }
}

// Leituras são ligadas ao canal. O usuário só enxerga canais dos seus dispositivos.
// Se pedir um canalId que não é dele, 404; se não pedir, vale a lista dele.
async function canaisPermitidos(req, res, next) {
  try {
    const dispositivos = await Dispositivo.find({ donoId: req.usuario.id }).select('canalId').lean();
    const meus = dispositivos.map((d) => d.canalId);
    const pedido = req.query.canalId;

    if (pedido !== undefined) {
      if (typeof pedido !== 'string' || !meus.includes(pedido)) return bloquear(req, res, 'canal', pedido);
      req.canais = [pedido];
    } else {
      req.canais = meus;
    }
    next();
  } catch (err) { next(err); }
}

module.exports = { safraDoDono, dispositivoDoDono, canaisPermitidos, bloquear };
