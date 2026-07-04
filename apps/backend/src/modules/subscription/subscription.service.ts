import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PaystackService } from '../../infra/paystack/paystack.service';
import { StripeService } from '../../infra/stripe/stripe.service';
import type { PaystackWebhookEvent } from './paystack-webhook-event';

export interface SubscriptionStatusView {
  isPremium: boolean;
  status: SubscriptionStatus | 'FREE';
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  priceLabel: string;
}

const ONE_MONTH_MS = 31 * 24 * 60 * 60 * 1000; // small grace over calendar month

/**
 * PassPath Premium — the paid tier that funds the AI + database costs (the AI
 * tutor's conversations, mock-exam generation/marking, and the underlying
 * OpenAI + hosting spend). Free accounts keep real value: browsing subjects,
 * career matching, calendar, past papers. Gateway details live in PaystackService;
 * this service only knows "is this student entitled" and "record what happened".
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly stripe: StripeService,
  ) {}

  /** Stripe when configured, else Paystack — one active provider at a time. */
  private get monthlyAmountCents(): number {
    return this.stripe.isConfigured ? this.stripe.monthlyAmountCents : this.paystack.monthlyAmountCents;
  }

  private requireStudent(studentId: string | undefined): string {
    if (!studentId) {
      throw new ForbiddenException('Only students can subscribe');
    }
    return studentId;
  }

  async status(studentId: string | undefined): Promise<SubscriptionStatusView> {
    const sid = this.requireStudent(studentId);
    const priceLabel = `R${(this.monthlyAmountCents / 100).toFixed(0)}/month`;
    const freeView: SubscriptionStatusView = { isPremium: false, status: 'FREE', currentPeriodEnd: null, cancelAtPeriodEnd: false, priceLabel };

    let sub: Awaited<ReturnType<typeof this.prisma.subscription.findUnique>>;
    try {
      sub = await this.prisma.subscription.findUnique({ where: { studentId: sid } });
    } catch (e) {
      // The subscriptions table may not exist yet on this database (e.g. storage-
      // constrained deploys where the migration hasn't landed). Never let that
      // break the app for students — just treat everyone as free-tier.
      this.logger.warn(`Subscription lookup failed, defaulting to free tier: ${(e as Error).message}`);
      return freeView;
    }
    if (!sub) {
      return freeView;
    }
    const isPremium =
      (sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.PAST_DUE) &&
      sub.currentPeriodEnd.getTime() > Date.now();
    return { isPremium, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd, cancelAtPeriodEnd: sub.cancelAtPeriodEnd, priceLabel };
  }

  /** Cheap entitlement check for other modules (tutor, exam) to gate on. */
  async isPremium(studentId: string | undefined): Promise<boolean> {
    if (!studentId) return false;
    const s = await this.status(studentId);
    return s.isPremium;
  }

  async checkout(studentId: string | undefined, email: string, callbackUrl: string): Promise<{ authorizationUrl: string }> {
    const sid = this.requireStudent(studentId);

    if (this.stripe.isConfigured) {
      const joiner = callbackUrl.includes('?') ? '&' : '?';
      const { url } = await this.stripe.createCheckoutSession({
        email,
        studentId: sid,
        successUrl: `${callbackUrl}${joiner}paid=1`,
        cancelUrl: callbackUrl,
      });
      return { authorizationUrl: url };
    }

    if (!this.paystack.isConfigured) {
      throw new BadRequestException('Payments are not set up yet — check back soon.');
    }
    const reference = `sub-${sid}-${Date.now()}`;
    const result = await this.paystack.initializeTransaction({
      email,
      reference,
      callbackUrl,
      metadata: { studentId: sid },
    });
    return { authorizationUrl: result.authorizationUrl };
  }

  async cancel(studentId: string | undefined): Promise<{ cancelAtPeriodEnd: boolean }> {
    const sid = this.requireStudent(studentId);
    const sub = await this.prisma.subscription.findUnique({ where: { studentId: sid } });
    if (!sub) {
      throw new NotFoundException('No active subscription');
    }
    // Local cancel is authoritative for entitlement; stopping the provider's
    // recurring charge is best-effort on top.
    await this.prisma.subscription.update({ where: { studentId: sid }, data: { cancelAtPeriodEnd: true } });
    if (sub.providerSubRef) {
      try {
        if (sub.providerSubRef.startsWith('sub_')) {
          await this.stripe.cancelAtPeriodEnd(sub.providerSubRef);
        } else {
          await this.paystack.disableSubscription(sub.providerSubRef, '');
        }
      } catch (e) {
        this.logger.warn(`Provider cancel failed (continuing, local cancel still applied): ${(e as Error).message}`);
      }
    }
    return { cancelAtPeriodEnd: true };
  }

  /**
   * The invoice→subscription reference moved between Stripe API versions
   * (top-level `subscription` vs `parent.subscription_details.subscription`);
   * check both shapes.
   */
  private stripeInvoiceSubRef(invoice: unknown): string | undefined {
    const inv = invoice as {
      subscription?: string | { id?: string };
      parent?: { subscription_details?: { subscription?: string | { id?: string } } };
    };
    const raw = inv.subscription ?? inv.parent?.subscription_details?.subscription;
    if (typeof raw === 'string') return raw;
    return raw?.id;
  }

  /**
   * Handle a verified Stripe webhook event. Idempotent: payments are recorded
   * by session/invoice id, so webhook retries are no-ops.
   */
  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const studentId = session.metadata?.studentId;
      if (!studentId) return;
      const reference = session.id;
      const existing = await this.prisma.subscriptionPayment.findUnique({ where: { reference } });
      if (existing) return;

      const providerSubRef = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      const sub = await this.prisma.subscription.upsert({
        where: { studentId },
        create: {
          studentId,
          status: SubscriptionStatus.ACTIVE,
          providerSubRef,
          currentPeriodEnd: new Date(Date.now() + ONE_MONTH_MS),
        },
        update: {
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date(Date.now() + ONE_MONTH_MS),
          ...(providerSubRef ? { providerSubRef } : {}),
        },
      });
      await this.prisma.subscriptionPayment.create({
        data: {
          subscriptionId: sub.id,
          reference,
          amountCents: session.amount_total ?? 0,
          status: 'success',
          raw: { type: event.type, id: event.id } as object,
        },
      });
      this.logger.log(`Stripe subscription activated for student ${studentId}`);
      return;
    }

    if (event.type === 'invoice.paid') {
      // Renewal: extend the period for the matching subscription.
      const invoice = event.data.object;
      const subRef = this.stripeInvoiceSubRef(invoice);
      if (!subRef) return;
      const existing = await this.prisma.subscriptionPayment.findUnique({ where: { reference: invoice.id ?? `inv-${event.id}` } });
      if (existing) return;
      const sub = await this.prisma.subscription.findFirst({ where: { providerSubRef: subRef } });
      if (!sub) return;
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.ACTIVE, currentPeriodEnd: new Date(Date.now() + ONE_MONTH_MS) },
      });
      await this.prisma.subscriptionPayment.create({
        data: {
          subscriptionId: sub.id,
          reference: invoice.id ?? `inv-${event.id}`,
          amountCents: invoice.amount_paid ?? 0,
          status: 'success',
          raw: { type: event.type, id: event.id } as object,
        },
      });
      return;
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const subRef = this.stripeInvoiceSubRef(invoice);
      if (!subRef) return;
      await this.prisma.subscription.updateMany({
        where: { providerSubRef: subRef },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
      return;
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      await this.prisma.subscription.updateMany({
        where: { providerSubRef: sub.id },
        data: { status: SubscriptionStatus.CANCELLED },
      });
    }
  }

  /**
   * Handle a verified Paystack webhook event. Idempotent on `reference` — a
   * retried webhook for the same transaction is a no-op the second time.
   */
  async handleWebhook(event: PaystackWebhookEvent): Promise<void> {
    const studentId = event.data.metadata?.studentId as string | undefined;

    if (event.event === 'charge.success') {
      if (!studentId || !event.data.reference) return;
      const existing = await this.prisma.subscriptionPayment.findUnique({ where: { reference: event.data.reference } });
      if (existing) return; // already processed

      const sub = await this.prisma.subscription.upsert({
        where: { studentId },
        create: {
          studentId,
          status: SubscriptionStatus.ACTIVE,
          providerSubRef: event.data.subscription_code,
          currentPeriodEnd: new Date(Date.now() + ONE_MONTH_MS),
        },
        update: {
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date(Date.now() + ONE_MONTH_MS),
          ...(event.data.subscription_code ? { providerSubRef: event.data.subscription_code } : {}),
        },
      });
      await this.prisma.subscriptionPayment.create({
        data: {
          subscriptionId: sub.id,
          reference: event.data.reference,
          amountCents: event.data.amount ?? 0,
          status: 'success',
          raw: event as unknown as object,
        },
      });
      this.logger.log(`Subscription activated for student ${studentId}`);
      return;
    }

    if (event.event === 'invoice.payment_failed') {
      if (!studentId) return;
      await this.prisma.subscription.updateMany({ where: { studentId }, data: { status: SubscriptionStatus.PAST_DUE } });
      return;
    }

    if (event.event === 'subscription.disable' || event.event === 'subscription.not_renew') {
      const code = event.data.subscription_code;
      if (!code) return;
      await this.prisma.subscription.updateMany({
        where: { providerSubRef: code },
        data: { status: SubscriptionStatus.CANCELLED },
      });
    }
  }
}
