import type { CardBrand, DeliveryStatus, LegalIdType, TransactionStatus } from '@norte/contracts';

export type DomainError =
  | { code: 'VALIDATION_ERROR'; message: string; details?: Record<string, string[]> }
  | { code: 'PRODUCT_NOT_FOUND'; productId: string }
  | { code: 'TRANSACTION_NOT_FOUND'; reference: string }
  | { code: 'CUSTOMER_NOT_FOUND'; customerId: string }
  | { code: 'DELIVERY_NOT_FOUND'; reference: string }
  | { code: 'INSUFFICIENT_STOCK'; productId: string; available: number; requested: number }
  | { code: 'DUPLICATE_REFERENCE'; reference: string }
  | { code: 'INVALID_TRANSACTION_STATE'; reference: string; current: TransactionStatus; attempted: string }
  | { code: 'PAYMENT_DECLINED'; reference: string; statusMessage?: string }
  | { code: 'PSP_UNAVAILABLE'; message: string }
  | { code: 'INVALID_EVENT_SIGNATURE' }
  | { code: 'DELIVERY_NOT_EDITABLE'; reference: string; status: DeliveryStatus };

export type { CardBrand, DeliveryStatus, LegalIdType, TransactionStatus };
