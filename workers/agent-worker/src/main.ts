import { Worker, type Job } from 'bullmq';
import { DeepSeekHarnessAdapter } from '@deepseek-harness/harness';
import type { AgentEvent } from '@deepseek-harness/shared';

interface AgentJob {
  kind: 'run';
  sessionId: string;
  workspacePath: string;
  prompt: string;
  model?: string;
}

interface CleanupJob {
  kind: 'cleanup';
}

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function finalText(events: AgentEvent[]): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'message' && e.role === 'assistant') return e.content;
  }
  return '';
}

/**
 * Run one prompt on a fresh DeepSeek Harness session and settle when the agent
 * becomes idle, then tear the runtime down. This is the background (offloaded)
 * path for long-running agent tasks; the interactive path lives in the API.
 */
async function runOnce(data: AgentJob): Promise<{ status: string; finalResponse: string }> {
  const adapter = new DeepSeekHarnessAdapter();
  const events: AgentEvent[] = [];
  let turnDone = false;
  let ended = false;

  await adapter.startSession({
    sessionId: data.sessionId,
    projectId: 'worker',
    workspacePath: data.workspacePath,
    model: data.model,
    onEvent: (e) => {
      events.push(e);
      if (e.type === 'status' && e.status === 'running') turnDone = false;
      if (e.type === 'session_ended') ended = true;
    },
  });

  await adapter.sendMessage(data.sessionId, data.prompt);

  const deadline = Date.now() + 30 * 60 * 1000;
  let lastStatus = 'starting';
  while (!ended && !turnDone) {
    if (Date.now() > deadline) {
      await adapter.stopSession(data.sessionId);
      break;
    }
    await sleep(250);
    lastStatus = await adapter.getStatus(data.sessionId);
    if (lastStatus === 'idle' || lastStatus === 'completed' || lastStatus === 'failed' || lastStatus === 'stopped') {
      turnDone = true;
    }
  }

  await adapter.disposeSession(data.sessionId);
  return { status: lastStatus, finalResponse: finalText(events) };
}

const worker = new Worker<AgentJob | CleanupJob>(
  'agent',
  async (job: Job<AgentJob | CleanupJob>) => {
    const data = job.data;
    if (data.kind === 'cleanup') {
      console.log(`[agent-worker] cleanup job ${job.id} (no-op)`);
      return { cleaned: 0 };
    }
    console.log(`[agent-worker] running agent job ${job.id} on ${data.workspacePath}`);
    return runOnce(data);
  },
  { connection },
);

worker.on('completed', (job) => console.log(`[agent-worker] job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[agent-worker] job ${job?.id} failed:`, err.message));

console.log(`[agent-worker] listening on redis://${connection.host}:${connection.port} (queue: agent)`);
