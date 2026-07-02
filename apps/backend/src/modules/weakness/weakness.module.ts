import { Module } from '@nestjs/common';
import { WeaknessController } from './weakness.controller';
import { WeaknessService } from './weakness.service';

@Module({
  controllers: [WeaknessController],
  providers: [WeaknessService],
  exports: [WeaknessService],
})
export class WeaknessModule {}
