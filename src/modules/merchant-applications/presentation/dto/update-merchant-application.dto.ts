import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { BusinessDetailsDto, OwnerContactDto, ProcessingProfileDto } from './business-details.dto';

class OwnerContactPatchDto extends PartialType(OwnerContactDto) {}
class ProcessingProfilePatchDto extends PartialType(ProcessingProfileDto) {}

// Every field is optional; nested objects are merged with existing values.
export class UpdateMerchantApplicationDto extends PartialType(
  OmitType(BusinessDetailsDto, ['owner', 'processing'] as const),
) {
  @ApiPropertyOptional({ type: OwnerContactPatchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OwnerContactPatchDto)
  owner?: OwnerContactPatchDto;

  @ApiPropertyOptional({ type: ProcessingProfilePatchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProcessingProfilePatchDto)
  processing?: ProcessingProfilePatchDto;
}
