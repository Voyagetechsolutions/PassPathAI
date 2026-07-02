import { ApiPropertyOptional } from '@nestjs/swagger';
import { KnowledgeSourceType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class IngestDocumentDto {
  @ApiPropertyOptional({
    enum: KnowledgeSourceType,
    default: KnowledgeSourceType.CURRICULUM,
    description: 'Which knowledge source these chunks represent',
  })
  @IsOptional()
  @IsEnum(KnowledgeSourceType)
  sourceType?: KnowledgeSourceType;
}
