import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Worker, type Job } from 'bullmq';

const execFileAsync = promisify(execFile);

interface SandboxJob {
  action: 'create' | 'start' | 'stop' | 'destroy' | 'exec';
  sandboxId?: string;
  containerName?: string;
  workspacePath?: string;
  image?: string;
  command?: string;
}

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
};
const image = process.env.SANDBOX_IMAGE ?? 'node:22-slim';

async function handle(data: SandboxJob): Promise<unknown> {
  switch (data.action) {
    case 'create': {
      const containerName = data.containerName ?? `dhwg-sbx-${Date.now()}`;
      await execFileAsync('docker', [
        'run', '-d', '--name', containerName, '--workdir', '/workspace',
        '-v', `${data.workspacePath}:/workspace`, image, 'tail', '-f', '/dev/null',
      ]);
      return { containerName };
    }
    case 'start':
      return execFileAsync('docker', ['start', data.containerName ?? '']);
    case 'stop':
      return execFileAsync('docker', ['stop', data.containerName ?? '']);
    case 'destroy':
      return execFileAsync('docker', ['rm', '-f', data.containerName ?? '']);
    case 'exec': {
      const { stdout, stderr } = await execFileAsync('docker', ['exec', data.containerName ?? '', 'sh', '-c', data.command ?? '']);
      return { stdout, stderr, exitCode: 0 };
    }
    default:
      throw new Error(`Unknown sandbox action: ${String(data.action)}`);
  }
}

const worker = new Worker<SandboxJob>('sandbox', async (job: Job<SandboxJob>) => {
  console.log(`[sandbox-worker] ${job.data.action} ${job.data.containerName ?? ''}`);
  return handle(job.data);
}, { connection });

worker.on('completed', (job) => console.log(`[sandbox-worker] job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[sandbox-worker] job ${job?.id} failed:`, err.message));

console.log(`[sandbox-worker] listening on redis://${connection.host}:${connection.port} (queue: sandbox)`);
