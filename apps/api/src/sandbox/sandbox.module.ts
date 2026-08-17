import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { SandboxController } from './sandbox.controller';
import { DockerSandboxManager } from './sandbox.service';

@Module({
  imports: [ProjectsModule],
  controllers: [SandboxController],
  providers: [DockerSandboxManager],
  exports: [DockerSandboxManager],
})
export class SandboxModule {}
