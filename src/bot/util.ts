export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Nível que o cliente exibe (o servidor guarda a partir de 0). */
export const shownLevel = (storedLevel: number) => storedLevel + 1;
