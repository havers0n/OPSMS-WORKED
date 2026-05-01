export type SessionCleanupHandler = () => void;

const handlers = new Set<SessionCleanupHandler>();

export function registerSessionCleanup(handler: SessionCleanupHandler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function runSessionCleanupHandlers() {
  for (const handler of handlers) {
    handler();
  }
}
