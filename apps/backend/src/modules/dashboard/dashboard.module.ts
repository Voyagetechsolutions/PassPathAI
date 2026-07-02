import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { StreakService } from './streak.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, StreakService],
  exports: [StreakService, DashboardService],
})
export class DashboardModule {}
