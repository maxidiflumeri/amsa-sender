import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmailPublicController } from './public-email.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EmailPublicController],
})
export class EmailPublicModule {}