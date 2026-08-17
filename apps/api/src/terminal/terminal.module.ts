import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { TerminalController } from './terminal.controller';
import { TerminalService } from './terminal.service';
import { TerminalGateway } from './terminal.gateway';

@Module({
  imports: [ProjectsModule],
  controllers: [TerminalController],
  providers: [TerminalService, TerminalGateway],
  exports: [TerminalService],
})
export class TerminalModule {}
