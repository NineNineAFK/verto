const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/initiate', paymentController.initiatePayment);
router.get('/redirect', paymentController.paymentRedirect);
router.get('/status', paymentController.getPaymentStatus);

// Debug-only: check token retrieval
router.get('/debug/token', async (req, res) => {
	const { getToken } = require('../service/phonepeClient');
	try {
		await getToken();
		return res.json({ ok: true });
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.response ? (err.response.data || err.response.statusText) : err.message });
	}
});

module.exports = router;

