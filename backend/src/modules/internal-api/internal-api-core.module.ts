import { Global, Module } from '@nestjs/common';
import { InternalApiConfig } from './config/internal-api.config';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';

@Global()
@Module({
    providers: [InternalApiConfig, InternalApiKeyGuard],
    exports: [InternalApiConfig, InternalApiKeyGuard],
})
export class InternalApiCoreModule { }
