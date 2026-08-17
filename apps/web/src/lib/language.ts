/** Map a file path to a Monaco language id. */
export function languageFor(path: string): string {
  const ext = (path.split('.').pop() ?? '').toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    py: 'python',
    go: 'go',
    rs: 'rust',
    sh: 'shell',
    bash: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    prisma: 'prisma',
    sql: 'sql',
    toml: 'ini',
    env: 'ini',
    dockerfile: 'dockerfile',
  };
  return map[ext] ?? 'plaintext';
}
