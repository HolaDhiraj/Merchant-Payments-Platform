import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Actor } from '../../../shared/domain/actor';
import { PLATFORM_ROLES, Role } from '../../../shared/domain/role.enum';
import { mapPage } from '../../../shared/application/pagination';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { CurrentActor } from '../../../shared/presentation/decorators/current-actor.decorator';
import { CreateMerchantApplicationUseCase } from '../application/use-cases/create-merchant-application.use-case';
import { UpdateMerchantApplicationUseCase } from '../application/use-cases/update-merchant-application.use-case';
import { GetMerchantApplicationUseCase } from '../application/use-cases/get-merchant-application.use-case';
import { ListMerchantApplicationsUseCase } from '../application/use-cases/list-merchant-applications.use-case';
import { SubmitMerchantApplicationUseCase } from '../application/use-cases/submit-merchant-application.use-case';
import { AssignReviewerUseCase } from '../application/use-cases/assign-reviewer.use-case';
import { RecordReviewDecisionUseCase } from '../application/use-cases/record-review-decision.use-case';
import { RetryRiskReviewUseCase } from '../application/use-cases/retry-risk-review.use-case';
import { GetRiskAssessmentUseCase } from '../application/use-cases/get-risk-assessment.use-case';
import { OnboardApprovedApplicationUseCase } from '../application/use-cases/onboard-approved-application.use-case';
import { CreateMerchantApplicationDto } from './dto/create-merchant-application.dto';
import { UpdateMerchantApplicationDto } from './dto/update-merchant-application.dto';
import { ListMerchantApplicationsQueryDto } from './dto/list-merchant-applications-query.dto';
import { AssignReviewerDto } from './dto/assign-reviewer.dto';
import { RecordDecisionDto } from './dto/record-decision.dto';
import {
  DecisionResponseDto,
  OnboardingCredentialsDto,
  MerchantApplicationPageResponseDto,
  MerchantApplicationResponseDto,
  RiskAssessmentResponseDto,
} from './dto/merchant-application-response.dto';

// HTTP adapter for the merchant application lifecycle. Each endpoint only translates
// HTTP <-> use case; roles are checked by the guard, object-level rules by the use case.
@ApiTags('Merchant applications')
@ApiBearerAuth()
@ApiNotFoundResponse({ description: 'Application does not exist or is not visible to the caller' })
// Platform staff only; method-level @Roles narrow this further.
@Roles(...PLATFORM_ROLES)
@Controller('merchant-applications')
export class MerchantApplicationsController {
  constructor(
    private readonly createApplication: CreateMerchantApplicationUseCase,
    private readonly updateApplication: UpdateMerchantApplicationUseCase,
    private readonly getApplication: GetMerchantApplicationUseCase,
    private readonly listApplications: ListMerchantApplicationsUseCase,
    private readonly submitApplication: SubmitMerchantApplicationUseCase,
    private readonly assignReviewer: AssignReviewerUseCase,
    private readonly recordDecision: RecordReviewDecisionUseCase,
    private readonly retryRiskReview: RetryRiskReviewUseCase,
    private readonly getRiskAssessment: GetRiskAssessmentUseCase,
    private readonly onboardApproved: OnboardApprovedApplicationUseCase,
  ) {}

  @Post()
  @Roles(Role.SALES, Role.ADMIN)
  @ApiOperation({ summary: 'Create a merchant application (starts in DRAFT)' })
  @ApiCreatedResponse({ type: MerchantApplicationResponseDto })
  async create(
    @CurrentActor() actor: Actor,
    @Body() dto: CreateMerchantApplicationDto,
  ): Promise<MerchantApplicationResponseDto> {
    const application = await this.createApplication.execute(actor, dto);
    return MerchantApplicationResponseDto.fromDomain(application);
  }

  @Get()
  @ApiOperation({
    summary: 'List applications visible to the caller, with status filter and pagination',
  })
  @ApiOkResponse({ type: MerchantApplicationPageResponseDto })
  async list(
    @CurrentActor() actor: Actor,
    @Query() query: ListMerchantApplicationsQueryDto,
  ): Promise<MerchantApplicationPageResponseDto> {
    const page = await this.listApplications.execute(actor, {
      status: query.status,
      assignedToMe: query.assignedToMe,
      page: { page: query.page, pageSize: query.pageSize },
    });
    return mapPage(page, MerchantApplicationResponseDto.fromDomain);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one application' })
  @ApiOkResponse({ type: MerchantApplicationResponseDto })
  async findOne(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MerchantApplicationResponseDto> {
    const application = await this.getApplication.execute(actor, id);
    return MerchantApplicationResponseDto.fromDomain(application);
  }

  @Patch(':id')
  @Roles(Role.SALES, Role.ADMIN)
  @ApiOperation({ summary: 'Update an application while it is DRAFT or INFO_REQUESTED' })
  @ApiOkResponse({ type: MerchantApplicationResponseDto })
  @ApiConflictResponse({ description: 'Application is not editable in its current status' })
  async update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMerchantApplicationDto,
  ): Promise<MerchantApplicationResponseDto> {
    const application = await this.updateApplication.execute(actor, id, dto);
    return MerchantApplicationResponseDto.fromDomain(application);
  }

  @Post(':id/submit')
  @Roles(Role.SALES, Role.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Submit for review; the risk check runs asynchronously' })
  @ApiAcceptedResponse({ type: MerchantApplicationResponseDto })
  @ApiConflictResponse({ description: 'Invalid state transition' })
  async submit(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MerchantApplicationResponseDto> {
    const application = await this.submitApplication.execute(actor, id);
    return MerchantApplicationResponseDto.fromDomain(application);
  }

  @Put(':id/reviewer')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Assign or re-assign the reviewer' })
  @ApiOkResponse({ type: MerchantApplicationResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Assignee is not an active reviewer' })
  async assign(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignReviewerDto,
  ): Promise<MerchantApplicationResponseDto> {
    const application = await this.assignReviewer.execute(actor, id, dto.reviewerId);
    return MerchantApplicationResponseDto.fromDomain(application);
  }

  @Post(':id/decision')
  @Roles(Role.REVIEWER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve, reject or request info (assigned reviewer only)',
    description: 'Approving also onboards the merchant and returns the owner\'s one-time password.',
  })
  @ApiOkResponse({ type: DecisionResponseDto })
  @ApiForbiddenResponse({ description: 'Caller is not the assigned reviewer' })
  @ApiConflictResponse({ description: 'Invalid state transition' })
  async decide(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordDecisionDto,
  ): Promise<DecisionResponseDto> {
    const { application, onboarding } = await this.recordDecision.execute(actor, id, dto);
    return { ...MerchantApplicationResponseDto.fromDomain(application), onboarding };
  }

  // For applications approved before onboarding was automatic.
  @Post(':id/onboarding')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Open the merchant account for an approved application' })
  @ApiCreatedResponse({ type: OnboardingCredentialsDto })
  @ApiConflictResponse({ description: 'The merchant or the owner email already exists' })
  onboard(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OnboardingCredentialsDto> {
    return this.onboardApproved.execute(actor, id);
  }

  @Post(':id/risk-review/retry')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Re-queue a failed or stuck risk review' })
  @ApiAcceptedResponse({ type: MerchantApplicationResponseDto })
  async retry(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MerchantApplicationResponseDto> {
    const application = await this.retryRiskReview.execute(actor, id);
    return MerchantApplicationResponseDto.fromDomain(application);
  }

  @Get(':id/risk-assessment')
  @ApiOperation({ summary: 'Latest risk assessment (score, level, reasons)' })
  @ApiOkResponse({ type: RiskAssessmentResponseDto })
  async riskAssessment(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RiskAssessmentResponseDto> {
    const { idempotencyKey: _idempotencyKey, ...assessment } = await this.getRiskAssessment.execute(
      actor,
      id,
    );
    return assessment;
  }
}
