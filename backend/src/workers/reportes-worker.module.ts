import { Module } from '@nestjs/common';
import { ReportesWorkerService } from './reportes-worker.service';
import { EmailModule } from 'src/modules/email/email.module';
import { QueueModule } from 'src/queues/queue.module';
import { ReportesEmailService } from 'src/modules/email/reportes-email/reportes-email.service';

@Module({
  imports: [QueueModule, EmailModule],
  providers: [ReportesEmailService, ReportesWorkerService],
})
export class ReportesWorkerModule {}