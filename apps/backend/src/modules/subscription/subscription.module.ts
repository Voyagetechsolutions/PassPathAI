import { Module } from '@nestjs/common';
import { PaystackModule } from '../../infra/paystack/paystack.module';
import { StripeModule } from '../../infra/stripe/stripe.module';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [PaystackModule, StripeModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
