import { Module } from '@nestjs/common';
import { CountdownController } from './countdown.controller';
import { CountdownService } from './countdown.service';

@Module({
  controllers: [CountdownController],
  providers: [CountdownService],
  exports: [CountdownService],
})
export class CountdownModule {}
