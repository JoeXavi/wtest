import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AcceptanceTokens,
  ChargeStatusResult,
  CreateChargeInput,
  CreateChargeResult,
  PaymentEvent,
  PaymentGateway,
} from '../../domain';
import { err, ok, type Result } from '../../shared/result';
import type { DomainError } from '../../domain/errors';
import type { TransactionStatus } from '@norte/contracts';

@Injectable()
export class PspHttpAdapter implements PaymentGateway {
  private readonly logger = new Logger(PspHttpAdapter.name);

  constructor(private readonly config: ConfigService) {}

  getPublicKey(): string {
    return this.config.getOrThrow<string>('PSP_PUBLIC_KEY');
  }

  private baseUrl(): string {
    return this.config.getOrThrow<string>('PSP_BASE_URL').replace(/\/$/, '');
  }

  private privateKey(): string {
    return this.config.getOrThrow<string>('PSP_PRIVATE_KEY');
  }

  private integritySecret(): string {
    return this.config.getOrThrow<string>('PSP_INTEGRITY_SECRET');
  }

  private eventsSecret(): string {
    return this.config.getOrThrow<string>('PSP_EVENTS_SECRET');
  }

  async getAcceptanceTokens(): Promise<Result<AcceptanceTokens, DomainError>> {
    try {
      const publicKey = this.getPublicKey();
      const response = await fetch(`${this.baseUrl()}/merchants/${publicKey}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return err({
          code: 'PSP_UNAVAILABLE',
          message: `Merchant lookup failed with ${response.status}`,
        });
      }
      const body = (await response.json()) as {
        data: {
          presigned_acceptance: { acceptance_token: string; permalink: string };
          presigned_personal_data_auth: { acceptance_token: string; permalink: string };
        };
      };
      return ok({
        acceptanceToken: body.data.presigned_acceptance.acceptance_token,
        acceptPersonalAuthToken: body.data.presigned_personal_data_auth.acceptance_token,
        policyLinks: {
          endUserPolicy: body.data.presigned_acceptance.permalink,
          personalDataAuth: body.data.presigned_personal_data_auth.permalink,
        },
      });
    } catch (error) {
      this.logger.warn(`getAcceptanceTokens failed: ${String(error)}`);
      return err({ code: 'PSP_UNAVAILABLE', message: 'Failed to fetch acceptance tokens' });
    }
  }

  computeIntegritySignature(reference: string, amountInCents: number, currency: string): string {
    const payload = `${reference}${amountInCents}${currency}${this.integritySecret()}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  async createCharge(input: CreateChargeInput): Promise<Result<CreateChargeResult, DomainError>> {
    try {
      const signature = this.computeIntegritySignature(
        input.reference,
        input.amountInCents,
        input.currency,
      );
      const response = await fetch(`${this.baseUrl()}/transactions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.privateKey()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          acceptance_token: input.acceptanceToken,
          accept_personal_auth: input.acceptPersonalAuth,
          amount_in_cents: input.amountInCents,
          currency: input.currency,
          customer_email: input.customerEmail,
          reference: input.reference,
          signature,
          payment_method: {
            type: 'CARD',
            token: input.cardToken,
            installments: input.installments,
          },
          customer_data: {
            full_name: input.customerData.fullName,
            phone_number: input.customerData.phoneNumber,
            legal_id: input.customerData.legalId,
            legal_id_type: input.customerData.legalIdType,
          },
          shipping_address: {
            address_line_1: input.shippingAddress.addressLine1,
            address_line_2: input.shippingAddress.addressLine2,
            city: input.shippingAddress.city,
            region: input.shippingAddress.region,
            country: input.shippingAddress.country,
            phone_number: input.shippingAddress.phoneNumber,
            name: input.shippingAddress.name,
            postal_code: input.shippingAddress.postalCode,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const text = await response.text();
      if (!response.ok) {
        this.logger.warn(
          `createCharge failed status=${response.status} body=${text.slice(0, 1000)}`,
        );
        return err({
          code: 'PSP_UNAVAILABLE',
          message: `Charge creation failed with ${response.status}`,
        });
      }

      const body = JSON.parse(text) as {
        data: {
          id: string;
          status: TransactionStatus;
          status_message?: string;
          reference?: string;
        };
      };

      this.logger.log(
        `createCharge PSP response reference=${input.reference} pspId=${body.data.id} status=${body.data.status} message=${body.data.status_message ?? 'none'} raw=${text.slice(0, 1000)}`,
      );

      return ok({
        pspTransactionId: body.data.id,
        status: body.data.status,
        statusMessage: body.data.status_message,
      });
    } catch (error) {
      this.logger.warn(`createCharge error: ${String(error)}`);
      return err({ code: 'PSP_UNAVAILABLE', message: 'Failed to create charge' });
    }
  }

  async getChargeStatus(
    pspTransactionId: string,
  ): Promise<Result<ChargeStatusResult, DomainError>> {
    try {
      const response = await fetch(`${this.baseUrl()}/transactions/${pspTransactionId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.getPublicKey()}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      });
      const text = await response.text();
      if (!response.ok) {
        this.logger.warn(
          `getChargeStatus failed pspId=${pspTransactionId} status=${response.status} body=${text.slice(0, 1000)}`,
        );
        return err({
          code: 'PSP_UNAVAILABLE',
          message: `Status lookup failed with ${response.status}`,
        });
      }
      const body = JSON.parse(text) as {
        data: {
          id: string;
          status: TransactionStatus;
          status_message?: string;
          reference: string;
        };
      };
      this.logger.log(
        `getChargeStatus PSP response pspId=${body.data.id} reference=${body.data.reference} status=${body.data.status} message=${body.data.status_message ?? 'none'} raw=${text.slice(0, 1000)}`,
      );
      return ok({
        pspTransactionId: body.data.id,
        status: body.data.status,
        statusMessage: body.data.status_message,
        reference: body.data.reference,
      });
    } catch (error) {
      this.logger.warn(`getChargeStatus error: ${String(error)}`);
      return err({ code: 'PSP_UNAVAILABLE', message: 'Failed to fetch charge status' });
    }
  }

  verifyEvent(
    payload: PaymentEvent,
    headerChecksum?: string,
  ): Result<PaymentEvent, DomainError> {
    try {
      const properties = payload.signature?.properties ?? [];
      const values = properties.map((path) => {
        const parts = path.split('.');
        let cursor: unknown = payload.data;
        for (const part of parts) {
          if (typeof cursor !== 'object' || cursor === null) return '';
          cursor = (cursor as Record<string, unknown>)[part];
        }
        return cursor == null ? '' : String(cursor);
      });
      const concat = `${values.join('')}${payload.timestamp}${this.eventsSecret()}`;
      const digest = createHash('sha256').update(concat).digest('hex').toUpperCase();
      const expected = (headerChecksum ?? payload.signature.checksum).toUpperCase();
      if (digest !== expected) {
        return err({ code: 'INVALID_EVENT_SIGNATURE' });
      }
      return ok(payload);
    } catch {
      return err({ code: 'INVALID_EVENT_SIGNATURE' });
    }
  }
}

/** Exported for unit tests against documented worked examples */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
