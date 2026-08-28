import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skip API token auth (health checks, PSP webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
