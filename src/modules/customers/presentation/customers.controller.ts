import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { mapPage } from '../../../shared/application/pagination';
import { Actor } from '../../../shared/domain/actor';
import { MERCHANT_ROLES } from '../../../shared/domain/role.enum';
import { CurrentActor } from '../../../shared/presentation/decorators/current-actor.decorator';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { PaginationQueryDto } from '../../../shared/presentation/dto/pagination-query.dto';
import { CustomerUseCases } from '../application/customer.use-cases';
import {
  CreateCustomerDto,
  CustomerLookupResponseDto,
  CustomerPageResponseDto,
  CustomerResponseDto,
  ListCustomersQueryDto,
  LookupCustomerQueryDto,
  LoyaltyEntryPageResponseDto,
  LoyaltyEntryResponseDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@ApiTags('Merchant portal')
@ApiBearerAuth()
@Roles(...MERCHANT_ROLES)
@Controller('merchant/customers')
export class CustomersController {
  constructor(private readonly customers: CustomerUseCases) {}

  @Get()
  @ApiOkResponse({ type: CustomerPageResponseDto })
  async list(@CurrentActor() actor: Actor, @Query() query: ListCustomersQueryDto): Promise<CustomerPageResponseDto> {
    const page = await this.customers.search(actor, query.q, { page: query.page, pageSize: query.pageSize });
    return mapPage(page, CustomerResponseDto.fromDomain);
  }

  @Get('lookup')
  @ApiOkResponse({ type: CustomerLookupResponseDto })
  async lookup(@CurrentActor() actor: Actor, @Query() query: LookupCustomerQueryDto): Promise<CustomerLookupResponseDto> {
    const customer = await this.customers.findByPhone(actor, query.phone);
    return { customer: customer && CustomerResponseDto.fromDomain(customer) };
  }

  @Post()
  @ApiCreatedResponse({ type: CustomerResponseDto })
  async create(@CurrentActor() actor: Actor, @Body() dto: CreateCustomerDto): Promise<CustomerResponseDto> {
    return CustomerResponseDto.fromDomain(await this.customers.create(actor, dto));
  }

  @Get(':id')
  @ApiOkResponse({ type: CustomerResponseDto })
  async get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string): Promise<CustomerResponseDto> {
    return CustomerResponseDto.fromDomain(await this.customers.get(actor, id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: CustomerResponseDto })
  async update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    return CustomerResponseDto.fromDomain(await this.customers.update(actor, id, dto));
  }

  @Get(':id/points')
  @ApiOkResponse({ type: LoyaltyEntryPageResponseDto })
  async points(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<LoyaltyEntryPageResponseDto> {
    await this.customers.get(actor, id);
    const page = await this.customers.ledger(actor, id, { page: query.page, pageSize: query.pageSize });
    return mapPage(page, LoyaltyEntryResponseDto.fromDomain);
  }
}
