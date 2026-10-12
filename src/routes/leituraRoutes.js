const router = require('express').Router();
const c = require('../controllers/leituraController');

router.get('/', c.listar);
router.get('/ultima', c.ultima);
router.get('/resumo', c.resumo);

module.exports = router;
