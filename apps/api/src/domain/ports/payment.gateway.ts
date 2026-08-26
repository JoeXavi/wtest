import type { TransactionStatus } from '@norte/contracts';
import type { Result } from '../../shared/result';
import type { DomainError } from '../errors';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type AcceptanceTokens = {
  acceptanceToken: string;
  acceptPersonalAuthToken: string;
  policyLinks: {
    endUserPolicy: string;
    personalDataAuth: string;
  };
};

export type CreateChargeInput = {
  reference: string;
  amountInCents: number;
  currency: 'COP';
  customerEmail: string;
  cardToken: string;
  installments: number;
  acceptanceToken: string;
  acceptPersonalAuth: string;
  customerData: {
    fullName: string;
    phoneNumber: string;
    legalId: string;
    legalIdType: string;
  };
  shippingAddress: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    region: string;
    country: string;
    phoneNumber: string;
    name: string;
    postalCode?: string;
  };
};

export type CreateChargeResult = {
  pspTransactionId: string;
  status: TransactionStatus;
  statusMessage?: string;
};

export type ChargeStatusResult = {
  pspTransactionId: string;
  status: TransactionStatus;
  statusMessage?: string;
  reference: string;
};

export type PaymentEvent = {
  eventType: string;
  environment: string;
  data: {
    transaction: {
      id: string;
      status: TransactionStatus;
      statusMessage?: string;
      reference: string;
      amountInCents: number;
    };
  };
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
};

export interface PaymentGateway {
  getPublicKey(): string;
  getAcceptanceTokens(): Promise<Result<AcceptanceTokens, DomainError>>;
  createCharge(input: CreateChargeInput): Promise<Result<CreateChargeResult, DomainError>>;
  getChargeStatus(pspTransactionId: string): Promise<Result<ChargeStatusResult, DomainError>>;
  verifyEvent(payload: PaymentEvent, headerChecksum?: string): Result<PaymentEvent, DomainError>;
}

export const CLOCK = Symbol('CLOCK');
export interface Clock {
  now(): Date;
  nowEpochSeconds(): number;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');
export interface IdGenerator {
  ulid(): string;
  reference(): string;
}
