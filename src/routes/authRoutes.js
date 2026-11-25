const router = require('express').Router();
const c = require('../controllers/authController');
const { autenticar, exigirTokenParcial } = require('../middlewares/autenticar');

router.post('/registrar', c.registrar);
router.post('/login', c.login);                                  // etapa 1: senha
router.post('/otp/confirmar', exigirTokenParcial, c.confirmarOtp); // primeiro acesso (QR)
router.post('/otp/verificar', exigirTokenParcial, c.verificarOtp); // etapa 2: código ou recuperação

router.get('/eu', autenticar, c.eu);
router.post('/recuperacao/regenerar', autenticar, c.regenerar);    // exige código OTP atual

module.exports = router;
