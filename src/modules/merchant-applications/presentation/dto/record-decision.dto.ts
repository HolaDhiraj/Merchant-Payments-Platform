import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReviewDecision } from '../../domain/model/review-decision.enum';

export class RecordDecisionDto {
  @ApiProperty({ enum: ReviewDecision })
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @ApiPropertyOptional({
    description: 'Required for REJECT and REQUEST_INFO, and for APPROVE of HIGH risk merchants',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
