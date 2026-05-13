import { Module } from '@nestjs/common';
import { InternalApiCoreModule } from './internal-api-core.module';
import { InternalEmailModule } from './features/email/internal-email.module';
import { InternalTimelineModule } from './features/timeline/internal-timeline.module';

@Module({
    imports: [InternalApiCoreModule, InternalEmailModule, InternalTimelineModule],
})
export class InternalApiModule { }
