import { Inject, Injectable } from '@nestjs/common';
import type { CustomerDto, DeliveryDto, UpdateDeliveryRequest } from '@norte/contracts';
import {
  CUSTOMER_REPOSITORY,
  DELIVERY_REPOSITORY,
  type CustomerRepository,
  type DeliveryRepository,
} from '../../domain';
import { map, type Result } from '../../shared/result';
import type { DomainError } from '../../domain/errors';

@Injectable()
export class GetCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
  ) {}

  async execute(customerId: string): Promise<Result<CustomerDto, DomainError>> {
    return map(await this.customers.findById(customerId), (c) => ({
      customerId: c.customerId,
      email: c.email,
      fullName: c.fullName,
      phone: c.phone,
    }));
  }
}

@Injectable()
export class GetDeliveryUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
  ) {}

  async execute(reference: string): Promise<Result<DeliveryDto, DomainError>> {
    return map(await this.deliveries.findByReference(reference), toDeliveryDto);
  }
}

@Injectable()
export class UpdateDeliveryUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
  ) {}

  async execute(
    reference: string,
    patch: UpdateDeliveryRequest,
  ): Promise<Result<DeliveryDto, DomainError>> {
    const result = await this.deliveries.update(reference, {
      recipientName: patch.recipientName,
      phone: patch.phone,
      address: {
        addressLine1: patch.addressLine1 ?? '',
        addressLine2: patch.addressLine2,
        city: patch.city ?? '',
        region: patch.region ?? '',
        postalCode: patch.postalCode,
        country: 'CO',
      },
    });
    return map(result, toDeliveryDto);
  }
}

function toDeliveryDto(d: {
  reference: string;
  status: DeliveryDto['status'];
  recipientName: string;
  phone: string;
  address: DeliveryDto['address'];
  assignedProductId?: string;
  assignedQuantity?: number;
  assignedAt?: string;
}): DeliveryDto {
  return {
    reference: d.reference,
    status: d.status,
    recipientName: d.recipientName,
    phone: d.phone,
    address: d.address,
    assignedProductId: d.assignedProductId,
    assignedQuantity: d.assignedQuantity,
    assignedAt: d.assignedAt,
  };
}
