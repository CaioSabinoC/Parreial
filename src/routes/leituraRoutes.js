const router = require('express').Router();
const c = require('../controllers/leituraController');
const { canaisPermitidos } = require('../middlewares/dono');

router.use(canaisPermitidos); // define req.canais (só os canais do usuário)

router.get('/', c.listar);
router.get('/ultima', c.ultima);
router.get('/ultimas', c.ultimas);
router.get('/serie', c.serie);
router.get('/resumo', c.resumo);

module.exports = router;
