const router = require('express').Router();
const c = require('../controllers/safraController');
const { safraDoDono } = require('../middlewares/dono');

router.post('/', c.criar);
router.get('/', c.listar);

// Rotas fixas ANTES de '/:id'
router.get('/previsao', c.previsaoPeriodo);

router.get('/:id', safraDoDono, c.buscar);
router.patch('/:id/encerrar', safraDoDono, c.encerrar);
router.get('/:id/previsao', safraDoDono, c.previsao);
router.get('/:id/previsoes', safraDoDono, c.historicoPrevisoes);

module.exports = router;
