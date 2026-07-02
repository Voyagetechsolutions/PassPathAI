import { Module } from '@nestjs/common';
import { DiagnosticModule } from '../diagnostic/diagnostic.module';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [DiagnosticModule, RoadmapModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
