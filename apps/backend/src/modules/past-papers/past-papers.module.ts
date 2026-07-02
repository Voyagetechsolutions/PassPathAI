import { Module } from '@nestjs/common';
import { PastPapersController } from './past-papers.controller';
import { PastPapersService } from './past-papers.service';

@Module({
  controllers: [PastPapersController],
  providers: [PastPapersService],
  exports: [PastPapersService],
})
export class PastPapersModule {}
