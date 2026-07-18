import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Attachment = {
  mimeType: string;
  data: string; // base64 (no data URL prefix) for API; or full data URL for image previews
  name?: string;
  kind: "image" | "file" | "generated-image";
  previewUrl?: string; // full data URL for rendering
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  attachments?: Attachment[];
};

export type Thread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: StoredMessage[];
};

const KEY = "aura-ai:threads:v1";

let cache: Thread[] | null = null;
const listeners = new Set<() => void>();

function read(): Thread[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Thread[]) : [];
  } catch {
    cache = [];
  }
  return cache ?? [];
}

function write(threads: Thread[]) {
  cache = threads;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(threads));
    } catch {
      // storage full — best effort
    }
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useThreads() {
  const threads = useSyncExternalStore(
    subscribe,
    () => read(),
    () => [] as Thread[],
  );
  return threads;
}

export function useThread(id: string | undefined) {
  const threads = useThreads();
  return id ? threads.find((t) => t.id === id) : undefined;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function createThread(): Thread {
  const t: Thread = {
    id: uid(),
    title: "New chat",
    updatedAt: Date.now(),
    messages: [],
  };
  write([t, ...read()]);
  return t;
}

export function deleteThread(id: string) {
  write(read().filter((t) => t.id !== id));
}

export function renameThread(id: string, title: string) {
  write(read().map((t) => (t.id === id ? { ...t, title } : t)));
}

export function upsertMessages(id: string, messages: StoredMessage[], titleHint?: string) {
  const threads = read();
  const existing = threads.find((t) => t.id === id);
  const title =
    existing?.title && existing.title !== "New chat"
      ? existing.title
      : (titleHint ?? existing?.title ?? "New chat").slice(0, 60);
  const next: Thread = {
    id,
    title,
    updatedAt: Date.now(),
    messages,
  };
  const others = threads.filter((t) => t.id !== id);
  write([next, ...others]);
}

export function ensureThreadExists(id: string) {
  const threads = read();
  if (threads.some((t) => t.id === id)) return;
  write([
    { id, title: "New chat", updatedAt: Date.now(), messages: [] },
    ...threads,
  ]);
}

/**
 * Convenience: hook returning helpers plus threads.
 */
export function useHistory() {
  const threads = useThreads();
  const remove = useCallback((id: string) => deleteThread(id), []);
  const create = useCallback(() => createThread(), []);
  const rename = useCallback((id: string, title: string) => renameThread(id, title), []);
  return { threads, remove, create, rename };
}

/** Hydration helper: true after first client render. */
export function useHydrated() {
  const store = useSyncExternalStore(
    (cb) => {
      cb();
      return () => {};
    },
    () => true,
    () => false,
  );
  return store;
}

// keep react happy about unused imports
void useEffect;