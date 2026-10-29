import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../../../shared/presentation/decorators/public.decorator';
import { HandleRiskProviderWebhookUseCase } from '../../application/use-cases/handle-risk-provider-webhook.use-case';
import { RiskProviderWebhookDto, WebhookAckDto } from './risk-provider-webhook.dto';
import {
  RiskWebhookSignatureGuard,
  WEBHOOK_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from './risk-webhook-signature.guard';

// Inbound callback from the third-party risk / KYB provider.
// Public for JWT purposes, but every request must carry a valid HMAC signature.
@ApiTags('Webhooks')
@Controller('webhooks')
export class RiskProviderWebhookController {
  constructor(private readonly handleWebhook: HandleRiskProviderWebhookUseCase) {}

  @Public()
  @UseGuards(RiskWebhookSignatureGuard)
  @Post('risk-provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive a signed risk assessment result from the provider' })
  @ApiHeader({
    name: WEBHOOK_ID_HEADER,
    required: true,
    description: 'Unique event id (de-duplication)',
  })
  @ApiHeader({ name: WEBHOOK_TIMESTAMP_HEADER, required: true, description: 'Unix seconds' })
  @ApiHeader({
    name: WEBHOOK_SIGNATURE_HEADER,
    required: true,
    description: 'v1=hex(HMAC-SHA256(secret, "<id>.<timestamp>.<raw body>"))',
  })
  @ApiOkResponse({ type: WebhookAckDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or expired signature' })
  async receive(
    @Headers(WEBHOOK_ID_HEADER) eventId: string,
    @Body() dto: RiskProviderWebhookDto,
  ): Promise<WebhookAckDto> {
    const outcome = await this.handleWebhook.execute({ eventId, ...dto });
    return { received: true, outcome };
  }
}
