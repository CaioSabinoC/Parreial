const router = require('express').Router();
const c = require('../controllers/dispositivoController');
const { dispositivoDoDono } = require('../middlewares/dono');

router.post('/', c.criar);
router.get('/', c.listar);

router.get('/:id', dispositivoDoDono, c.buscar);
router.patch('/:id', dispositivoDoDono, c.alterar);
router.post('/:id/comandos', dispositivoDoDono, c.comandar);

module.exports = router;
