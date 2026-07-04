import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PaystackService } from '../../infra/paystack/paystack.service';
import { StripeService } from '../../infra/stripe/stripe.service';
import { SubscriptionService } from './subscription.service';
import { CheckoutDto } from './dto/checkout.dto';
import type { PaystackWebhookEvent } from './paystack-webhook-event';

const DEFAULT_CALLBACK_URL = 'passpath://payment-callback';

@ApiTags('subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly paystack: PaystackService,
    private readonly stripe: StripeService,
  ) {}

  @Get('me')
  @ApiBearerAuth()
  @Roles(Role.student)
  @ApiOperation({ summary: 'Current student’s subscription status' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.status(user.studentProfileId);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.student)
  @ApiOperation({ summary: 'Start a Paystack checkout for Premium' })
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutDto) {
    return this.subscriptions.checkout(user.studentProfileId, user.email, dto.callbackUrl ?? DEFAULT_CALLBACK_URL);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.student)
  @ApiOperation({ summary: 'Cancel Premium at the end of the current period' })
  cancel(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.cancel(user.studentProfileId);
  }

  /**
   * Paystack calls this directly — no student is signed in, so it's @Public()
   * and trust comes entirely from the HMAC signature, verified against the raw
   * request bytes (main.ts enables rawBody capture for this).
   */
  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook — verified via signature, not auth' })
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-paystack-signature') signature?: string) {
    if (!req.rawBody || !this.paystack.verifyWebhookSignature(req.rawBody, signature)) {
      throw new BadRequestException('Invalid signature');
    }
    const event = JSON.parse(req.rawBody.toString('utf8')) as PaystackWebhookEvent;
    await this.subscriptions.handleWebhook(event);
    return { received: true };
  }

  /**
   * Stripe calls this directly — @Public(), trust comes from the stripe-signature
   * HMAC verified against the raw request bytes.
   */
  @Post('stripe-webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook — verified via signature, not auth' })
  async stripeWebhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    const event = req.rawBody ? this.stripe.parseWebhook(req.rawBody, signature) : null;
    if (!event) {
      throw new BadRequestException('Invalid signature');
    }
    await this.subscriptions.handleStripeEvent(event);
    return { received: true };
  }
}
