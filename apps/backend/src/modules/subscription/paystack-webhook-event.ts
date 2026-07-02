// Paystack webhook payload shape (only the fields we read). Not a class-validator
// DTO — the payload is verified via HMAC signature, not structural validation.
export interface PaystackWebhookEvent {
  event: string; // 'charge.success' | 'subscription.create' | 'subscription.disable' | 'invoice.payment_failed' | ...
  data: {
    reference?: string;
    amount?: number;
    status?: string;
    customer?: { email?: string; customer_code?: string };
    metadata?: Record<string, unknown> | null;
    subscription_code?: string;
    email_token?: string;
    plan?: { plan_code?: string };
    next_payment_date?: string;
  };
}
