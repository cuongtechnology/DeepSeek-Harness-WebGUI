import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PermissionDecision } from '@deepseek-harness/shared';

export class CreateSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adapterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  message!: string;
}

export class ResolveApprovalDto {
  @ApiProperty()
  @IsIn(['allow_once', 'allow_always', 'deny'])
  decision!: PermissionDecision;
}

export class InstallRuntimeDto {
  @ApiPropertyOptional({ enum: ['pip', 'source'] })
  @IsOptional()
  @IsIn(['pip', 'source'])
  method?: 'pip' | 'source';
}
