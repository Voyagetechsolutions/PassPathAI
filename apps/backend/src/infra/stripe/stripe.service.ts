import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { AppConfig } from '../../config/configuration';

/**
 * Thin wrapper over Stripe: hosted Checkout for the Premium subscription and
 * signature-verified webhooks. Amount/currency come from config so the price
 * can change without code. If STRIPE_PRICE_ID is set, that price is used
 * instead of an ad-hoc price (recommended once the product exists in Stripe).
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client?: Stripe;
  private readonly webhookSecret: string;
  private readonly priceId: string;
  readonly monthlyAmountCents: number;

  constructor(config: ConfigService<AppConfig, true>) {
    const stripe = config.get('stripe', { infer: true });
    this.webhookSecret = stripe.webhookSecret;
    this.priceId = stripe.priceId;
    this.monthlyAmountCents = stripe.monthlyAmountCents;
    if (stripe.secretKey) {
      this.client = new Stripe(stripe.secretKey);
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.client);
  }

  private require(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    return this.client;
  }

  async createCheckoutSession(input: {
    email: string;
    studentId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    const session = await this.require().checkout.sessions.create({
      mode: 'subscription',
      customer_email: input.email,
      line_items: [
        this.priceId
          ? { price: this.priceId, quantity: 1 }
          : {
              price_data: {
                currency: 'zar',
                product_data: { name: 'PassPath Premium', description: 'Unlimited AI tutoring and mock exams' },
                recurring: { interval: 'month' },
                unit_amount: this.monthlyAmountCents,
              },
              quantity: 1,
            },
      ],
      metadata: { studentId: input.studentId },
      subscription_data: { metadata: { studentId: input.studentId } },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      allow_promotion_codes: true,
    });
    if (!session.url) {
      throw new ServiceUnavailableException('Stripe did not return a checkout URL');
    }
    return { url: session.url };
  }

  /** Verify and parse a webhook. Returns null when the signature is invalid. */
  parseWebhook(rawBody: Buffer, signature: string | undefined): Stripe.Event | null {
    if (!signature || !this.webhookSecret || !this.client) {
      return null;
    }
    try {
      return this.require().webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (e) {
      this.logger.warn(`Stripe webhook signature verification failed: ${(e as Error).message}`);
      return null;
    }
  }

  async cancelAtPeriodEnd(subscriptionId: string): Promise<void> {
    await this.require().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  }
}
