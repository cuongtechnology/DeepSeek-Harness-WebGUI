/** Minimal FIFO queue that is also an AsyncIterable, for streaming events. */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private resolvers: Array<(result: IteratorResult<T>) => void> = [];
  private closed = false;

  push(item: T): void {
    if (this.closed) return;
    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver({ value: item, done: false });
    } else {
      this.items.push(item);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    while (this.resolvers.length > 0) {
      const resolver = this.resolvers.shift();
      resolver?.({ value: undefined as unknown as T, done: true });
    }
  }

  get size(): number {
    return this.items.length;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    const next = (): Promise<IteratorResult<T>> => {
      if (this.items.length > 0) {
        return Promise.resolve({ value: this.items.shift() as T, done: false });
      }
      if (this.closed) {
        return Promise.resolve({ value: undefined as unknown as T, done: true });
      }
      return new Promise<IteratorResult<T>>((resolve) => this.resolvers.push(resolve));
    };
    return { next };
  }
}
