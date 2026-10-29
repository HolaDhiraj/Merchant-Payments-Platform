import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { RiskLevel } from '../../domain/model/risk.enums';
import { RISK_ASSESSMENT_COMPLETED_EVENT } from '../../application/use-cases/handle-risk-provider-webhook.use-case';

export class RiskProviderWebhookDto {
  @ApiProperty({ enum: [RISK_ASSESSMENT_COMPLETED_EVENT] })
  @IsIn([RISK_ASSESSMENT_COMPLETED_EVENT])
  eventType: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  applicationId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  submissionNumber: number;

  @ApiProperty({ example: 'acme-kyb' })
  @IsString()
  @Length(1, 64)
  provider: string;

  @ApiProperty({ example: 'kyb_ref_123' })
  @IsString()
  @Length(1, 128)
  providerReference: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @ApiProperty({ enum: RiskLevel })
  @IsEnum(RiskLevel)
  level: RiskLevel;

  @ApiProperty({ type: [String], example: ['HIGH_RISK_MCC'] })
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(/^[A-Z0-9_]{1,64}$/, { each: true })
  reasons: string[];

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  assessedAt: Date;
}

export class WebhookAckDto {
  @ApiProperty() received: true;
  @ApiProperty({ example: 'APPLIED' }) outcome: string;
}
