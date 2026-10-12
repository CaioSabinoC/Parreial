const router = require('express').Router();
const c = require('../controllers/safraController');

router.post('/', c.criar);
router.get('/', c.listar);

// Rotas fixas ANTES de '/:id'
router.get('/previsao', c.previsaoPeriodo);

router.get('/:id', c.buscar);
router.patch('/:id/encerrar', c.encerrar);
router.get('/:id/previsao', c.previsao);
router.get('/:id/previsoes', c.historicoPrevisoes);

module.exports = router;
