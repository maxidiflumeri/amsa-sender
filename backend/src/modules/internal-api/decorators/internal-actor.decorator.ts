import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { InternalActor as InternalActorType } from '../config/internal-api.types';

export const InternalActor = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): InternalActorType => {
        const req = ctx.switchToHttp().getRequest();
        return req.internalActor;
    },
);

export type { InternalActorType as InternalActorPayload };
