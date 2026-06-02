export function createId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2);
  const timePart = Date.now().toString(36);

  return `${timePart}-${randomPart}`;
}
