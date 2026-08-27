export type Currency = 'COP';

export type TransactionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED'
  | 'VOIDED'
  | 'ERROR';

export type CardBrand = 'visa' | 'mastercard' | 'unknown';

export type LegalIdType = 'CC' | 'CE' | 'NIT' | 'PP' | 'TI' | 'DNI' | 'RG' | 'OTHER';

export type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'CANCELLED';

export interface AmountBreakdown {
  itemCents: number;
  baseFeeCents: number;
  deliveryFeeCents: number;
  totalCents: number;
}

export interface ProductDto {
  productId: string;
  name: string;
  description: string;
  unit: 'HOUR';
  unitPriceCents: number;
  currency: Currency;
  usdUnitPrice: number;
  available: number;
  image: {
    key: string;
    width: number;
    height: number;
    alt: string;
  };
}

export interface StockDto {
  productId: string;
  available: number;
  unit: 'HOUR';
}

export interface CustomerInput {
  email: string;
  fullName: string;
  phone: string;
  legalId: string;
  legalIdType: LegalIdType;
}

export interface DeliveryInput {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region: string;
  postalCode?: string;
  country: string;
  phone: string;
  recipientName: string;
}

export interface StartCheckoutRequest {
  productId: string;
  hours: number;
  customer: CustomerInput;
  delivery: DeliveryInput;
}

export interface StartCheckoutResponse {
  transactionReference: string;
  status: 'PENDING';
  amounts: AmountBreakdown;
  currency: Currency;
  psp: {
    publicKey: string;
    acceptanceToken: string;
    acceptPersonalAuthToken: string;
    policyLinks: {
      endUserPolicy: string;
      personalDataAuth: string;
    };
  };
}

export interface PayTransactionRequest {
  cardToken: string;
  installments: number;
  acceptanceToken: string;
  acceptPersonalAuth: string;
  cardBrand: CardBrand;
  cardLast4: string;
}

export interface PayTransactionResponse {
  transactionReference: string;
  status: TransactionStatus;
  statusMessage?: string;
  amounts: AmountBreakdown;
}

export interface CancelCheckoutResponse {
  transactionReference: string;
  status: TransactionStatus;
  statusMessage?: string;
  amounts: AmountBreakdown;
}

export interface TransactionDto {
  reference: string;
  status: TransactionStatus;
  statusMessage?: string;
  amounts: AmountBreakdown;
  card?: { brand: CardBrand; last4: string };
  product: { name: string; hours: number };
  finalizedAt?: string;
}

export interface CustomerDto {
  customerId: string;
  email: string;
  fullName: string;
  phone: string;
}

export interface DeliveryDto {
  reference: string;
  status: DeliveryStatus;
  recipientName: string;
  phone: string;
  address: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    region: string;
    postalCode?: string;
    country: string;
  };
  assignedProductId?: string;
  assignedQuantity?: number;
  assignedAt?: string;
}

export interface UpdateDeliveryRequest {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  phone?: string;
  recipientName?: string;
}

export interface HealthDto {
  status: 'ok';
  version: string;
}
