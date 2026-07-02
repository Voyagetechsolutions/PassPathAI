import { Module } from '@nestjs/common';
import { WeaknessModule } from '../weakness/weakness.module';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';

@Module({
  imports: [WeaknessModule],
  controllers: [PracticeController],
  providers: [PracticeService],
})
export class PracticeModule {}
