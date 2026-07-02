import { Module } from '@nestjs/common';
import { WeaknessModule } from '../weakness/weakness.module';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { DiagnosticController } from './diagnostic.controller';
import { DiagnosticService } from './diagnostic.service';

@Module({
  imports: [WeaknessModule, RoadmapModule],
  controllers: [DiagnosticController],
  providers: [DiagnosticService],
  exports: [DiagnosticService],
})
export class DiagnosticModule {}
