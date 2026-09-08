import { Router } from 'express';
import { handleRazorpayWebhook } from '../controllers/webhookController';

const router = Router();

router.post('/razorpay', handleRazorpayWebhook);

export default router;
