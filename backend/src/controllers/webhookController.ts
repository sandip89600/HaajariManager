import { Request, Response } from 'express';
import crypto from 'crypto';
import { PaymentTransaction, UserSubscription, SubscriptionAuditLog, Tenant } from '../models';

export async function handleRazorpayWebhook(req: Request, res: Response) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret';
    const signature = req.headers['x-razorpay-signature'] as string;

    // Verify webhook signature if secret configured
    if (signature && process.env.RAZORPAY_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('[Razorpay Webhook Warning] Signature mismatch');
        return res.status(400).json({ status: 'error', message: 'Invalid webhook signature' });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`[Razorpay Webhook] Received Event: ${event}`);

    if (event === 'order.paid' || event === 'payment.captured') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        const transaction = await PaymentTransaction.findOne({ razorpayOrderId: orderId });
        if (transaction && transaction.status !== 'SUCCESS') {
          transaction.status = 'SUCCESS';
          transaction.razorpayPaymentId = paymentId;
          transaction.rawPayload = req.body;
          await transaction.save();

          // Grant subscription entitlement
          let durationDays = 30;
          if (transaction.billingCycle === '3_MONTH') durationDays = 90;
          if (transaction.billingCycle === '6_MONTH') durationDays = 180;
          if (transaction.billingCycle === '12_MONTH') durationDays = 365;

          const startDate = new Date();
          const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

          await UserSubscription.findOneAndUpdate(
            { tenantId: transaction.tenantId },
            {
              tenantId: transaction.tenantId,
              planCode: transaction.planCode,
              billingCycle: transaction.billingCycle,
              status: 'ACTIVE',
              startDate,
              endDate,
              autoRenew: false,
              isPromo: transaction.isPromo,
            },
            { upsert: true }
          );

          await Tenant.findByIdAndUpdate(transaction.tenantId, {
            plan: transaction.planCode.toLowerCase(),
            planExpiresAt: endDate,
          });

          await SubscriptionAuditLog.create({
            actorId: 'RAZORPAY_WEBHOOK',
            actorRole: 'SYSTEM',
            tenantId: transaction.tenantId,
            action: 'WEBHOOK_PAYMENT_CAPTURED',
            details: { event, orderId, paymentId, planCode: transaction.planCode, endDate },
          });
        }
      }
    }

    return res.status(200).json({ status: 'ok', received: true });
  } catch (err: any) {
    console.error('[Razorpay Webhook Error]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
