import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { AppConfig } from '../../config/configuration';

const BASE_URL = 'https://api.paystack.co';

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifyTransactionResult {
  status: string; // 'success' | 'failed' | 'abandoned' | ...
  reference: string;
  amountCents: number;
  customerEmail: string;
  metadata: Record<string, unknown>;
}

/**
 * Thin wrapper over the Paystack REST API — the only place that knows Paystack's
 * request/response shapes. SubscriptionService depends on this, never on `fetch`
 * or the API directly, so swapping gateways later stays contained to this file.
 */
@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly secretKey: string;
  readonly publicKey: string;
  readonly planCode: string;
  readonly monthlyAmountCents: number;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const paystack = this.config.get('paystack', { infer: true });
    this.secretKey = paystack.secretKey;
    this.publicKey = paystack.publicKey;
    this.planCode = paystack.planCode;
    this.monthlyAmountCents = paystack.monthlyAmountCents;
    if (!this.secretKey) {
      this.logger.warn('PAYSTACK_SECRET_KEY not set — subscriptions/payments will be unavailable.');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.secretKey);
  }

  private requireConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('Payments are not configured yet.');
    }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    const body = (await res.json()) as { status: boolean; message: string; data: T };
    if (!res.ok || !body.status) {
      throw new Error(`Paystack error: ${body.message ?? res.statusText}`);
    }
    return body.data;
  }

  /**
   * Start a hosted-checkout transaction. If a recurring plan code is configured,
   * the first successful charge on it auto-creates a Paystack subscription;
   * otherwise this is a plain one-time charge (renewed manually via re-checkout).
   */
  async initializeTransaction(params: {
    email: string;
    reference: string;
    callbackUrl: string;
    metadata: Record<string, unknown>;
  }): Promise<InitializeTransactionResult> {
    this.requireConfigured();
    const data = await this.request<{ authorization_url: string; access_code: string; reference: string }>(
      '/transaction/initialize',
      {
        method: 'POST',
        body: JSON.stringify({
          email: params.email,
          amount: this.monthlyAmountCents,
          currency: 'ZAR',
          reference: params.reference,
          callback_url: params.callbackUrl,
          metadata: params.metadata,
          ...(this.planCode ? { plan: this.planCode } : {}),
        }),
      },
    );
    return { authorizationUrl: data.authorization_url, accessCode: data.access_code, reference: data.reference };
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    this.requireConfigured();
    const data = await this.request<{
      status: string;
      reference: string;
      amount: number;
      customer: { email: string };
      metadata: Record<string, unknown> | null;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
    return {
      status: data.status,
      reference: data.reference,
      amountCents: data.amount,
      customerEmail: data.customer.email,
      metadata: data.metadata ?? {},
    };
  }

  /** Disable a recurring Paystack subscription (used on cancel). Best-effort. */
  async disableSubscription(subscriptionCode: string, emailToken: string): Promise<void> {
    this.requireConfigured();
    await this.request('/subscription/disable', {
      method: 'POST',
      body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
    });
  }

  /**
   * Verify the `x-paystack-signature` header: HMAC-SHA512 of the raw request body
   * using the secret key. Must run against the exact raw bytes Paystack sent.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!this.isConfigured || !signature) return false;
    const hash = crypto.createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    return hash === signature;
  }
}
