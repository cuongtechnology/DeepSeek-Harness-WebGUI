'use client';

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@deepseek-harness/ui';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

export interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  onSelect: () => void;
}

/**
 * A VS Code-style command palette modal: overlay + filterable, keyboard-navigable
 * list. Used for both the command palette (Ctrl+K) and quick-open (Ctrl+P).
 */
export function Palette({
  open,
  onClose,
  items,
  placeholder,
  emptyText,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  items: PaletteItem[];
  placeholder: string;
  emptyText: string;
  loading?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const q = query.toLowerCase();
  const filtered = q ? items.filter((i) => `${i.label} ${i.sublabel ?? ''}`.toLowerCase().includes(q)) : items;

  function select(item: PaletteItem) {
    item.onSelect();
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && filtered[active]) {
      e.preventDefault();
      select(filtered[active]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh]" onClick={onClose}>
      <div
        className="w-[min(640px,90vw)] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="h-11 w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
              <Spinner /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-zinc-600">{emptyText}</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => select(item)}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm ${
                  i === active ? 'bg-zinc-800' : ''
                }`}
              >
                {item.icon && <span className="shrink-0 text-zinc-500">{item.icon}</span>}
                <span className="truncate text-zinc-200">{item.label}</span>
                {item.sublabel && <span className="ml-auto truncate pl-3 font-mono text-xs text-zinc-600">{item.sublabel}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
