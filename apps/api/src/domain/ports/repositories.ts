import type { Product } from '../product';
import type { Result } from '../../shared/result';
import type { DomainError } from '../errors';
import type { Transaction } from '../transaction';
import type { Customer } from '../customer';
import type { Delivery } from '../delivery';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductRepository {
  findById(productId: string): Promise<Result<Product, DomainError>>;
  list(): Promise<Result<Product[], DomainError>>;
  sweepExpiredReservations(productId: string): Promise<Result<number, DomainError>>;
}

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export type StartCheckoutWrite = {
  productId: string;
  quantity: number;
  reservationExpiresAt: number;
  transaction: Transaction;
  delivery: Delivery;
  customer: Customer;
  isNewCustomer: boolean;
};

export interface TransactionRepository {
  findByReference(reference: string): Promise<Result<Transaction, DomainError>>;
  startCheckout(write: StartCheckoutWrite): Promise<Result<Transaction, DomainError>>;
  attachPsp(
    reference: string,
    pspTransactionId: string,
    card: { brand: string; last4: string },
  ): Promise<Result<Transaction, DomainError>>;
  finalizeApproved(
    reference: string,
    statusMessage?: string,
  ): Promise<Result<Transaction, DomainError>>;
  finalizeRejected(
    reference: string,
    status: 'DECLINED' | 'ERROR' | 'VOIDED',
    statusMessage?: string,
  ): Promise<Result<Transaction, DomainError>>;
}

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');

export interface CustomerRepository {
  findById(customerId: string): Promise<Result<Customer, DomainError>>;
  findByEmail(email: string): Promise<Result<Customer | null, DomainError>>;
}

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');

export interface DeliveryRepository {
  findByReference(reference: string): Promise<Result<Delivery, DomainError>>;
  update(
    reference: string,
    patch: Partial<Pick<Delivery, 'recipientName' | 'phone' | 'address'>>,
  ): Promise<Result<Delivery, DomainError>>;
}
