import type { LegalIdType } from '@norte/contracts';

export type Customer = {
  customerId: string;
  email: string;
  fullName: string;
  phone: string;
  legalId: string;
  legalIdType: LegalIdType;
  createdAt: string;
  updatedAt: string;
};
