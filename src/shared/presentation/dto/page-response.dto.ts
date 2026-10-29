import { ApiProperty } from '@nestjs/swagger';

// Pagination metadata returned alongside every list response.
export class PageMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;
}
