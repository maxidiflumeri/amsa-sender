import { Module } from '@nestjs/common';
import { InternalApiCoreModule } from './internal-api-core.module';
import { InternalEmailModule } from './features/email/internal-email.module';

@Module({
    imports: [InternalApiCoreModule, InternalEmailModule],
})
export class InternalApiModule { }
