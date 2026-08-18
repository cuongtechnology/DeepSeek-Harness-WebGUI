import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
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

export class UpdateRuntimeConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  command?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  args?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cordisConfig?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  apiKey?: string;
}
