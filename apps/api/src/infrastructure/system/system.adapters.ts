import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import type { Clock, IdGenerator } from '../../domain';

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowEpochSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }
}

@Injectable()
export class UlidGenerator implements IdGenerator {
  ulid(): string {
    return ulid();
  }

  reference(): string {
    return `NOR-${ulid()}`;
  }
}
