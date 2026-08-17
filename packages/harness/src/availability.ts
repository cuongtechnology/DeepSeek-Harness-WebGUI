import { accessSync, constants } from 'node:fs';
import { isAbsolute, join, delimiter } from 'node:path';

export interface AvailabilityResult {
  available: boolean;
  path?: string;
  reason?: string;
}

/**
 * Detect whether a command is available without executing it. Handles both
 * absolute/relative paths and bare command names resolved against PATH.
 */
export function isCommandAvailable(command: string, env: NodeJS.ProcessEnv = process.env): AvailabilityResult {
  if (command.includes('/') || isAbsolute(command)) {
    try {
      accessSync(command, constants.X_OK);
      return { available: true, path: command };
    } catch {
      return { available: false, reason: `executable not found or not executable: ${command}` };
    }
  }

  const pathVar = env.PATH ?? '';
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, command);
    try {
      accessSync(candidate, constants.X_OK);
      return { available: true, path: candidate };
    } catch {
      // keep searching
    }
  }

  return { available: false, reason: `command not found in PATH: ${command}` };
}

/** Locate the harness binary, or throw a descriptive error if it is missing. */
export function assertHarnessAvailable(config: { command: string }): string {
  const result = isCommandAvailable(config.command);
  if (!result.available || !result.path) {
    throw new Error(
      `DeepSeek Harness binary unavailable (${result.reason}). ` +
        `Set DEEPSEEK_HARNESS_COMMAND to the harness executable path.`,
    );
  }
  return result.path;
}
