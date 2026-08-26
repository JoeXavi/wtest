import type { DeliveryStatus } from '@norte/contracts';
import { err, ok, type Result } from '../shared/result';
import type { DomainError } from './errors';

export type DeliveryAddress = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region: string;
  postalCode?: string;
  country: string;
};

export type Delivery = {
  reference: string;
  recipientName: string;
  phone: string;
  address: DeliveryAddress;
  status: DeliveryStatus;
  assignedProductId?: string;
  assignedQuantity?: number;
  assignedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export function assignProduct(
  delivery: Delivery,
  productId: string,
  quantity: number,
): Result<Delivery, DomainError> {
  if (delivery.status !== 'PENDING') {
    return err({
      code: 'DELIVERY_NOT_EDITABLE',
      reference: delivery.reference,
      status: delivery.status,
    });
  }
  return ok({
    ...delivery,
    status: 'ASSIGNED',
    assignedProductId: productId,
    assignedQuantity: quantity,
    assignedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function cancelDelivery(delivery: Delivery): Result<Delivery, DomainError> {
  if (delivery.status === 'ASSIGNED') {
    return err({
      code: 'DELIVERY_NOT_EDITABLE',
      reference: delivery.reference,
      status: delivery.status,
    });
  }
  return ok({
    ...delivery,
    status: 'CANCELLED',
    updatedAt: new Date().toISOString(),
  });
}

export function updatePendingDelivery(
  delivery: Delivery,
  patch: Partial<Pick<Delivery, 'recipientName' | 'phone' | 'address'>>,
): Result<Delivery, DomainError> {
  if (delivery.status !== 'PENDING') {
    return err({
      code: 'DELIVERY_NOT_EDITABLE',
      reference: delivery.reference,
      status: delivery.status,
    });
  }
  return ok({
    ...delivery,
    ...patch,
    address: patch.address ? { ...delivery.address, ...patch.address } : delivery.address,
    updatedAt: new Date().toISOString(),
  });
}
