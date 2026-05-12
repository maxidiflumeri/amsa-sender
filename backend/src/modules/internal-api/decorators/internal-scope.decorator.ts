import { SetMetadata } from '@nestjs/common';

export const INTERNAL_SCOPE_KEY = 'internal-scope';

export const InternalScope = (scope: string) => SetMetadata(INTERNAL_SCOPE_KEY, scope);
