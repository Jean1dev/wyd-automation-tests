// Contas de jogador criadas na hora no portal do operador: uma conta nova por caso de teste.
//
// Contrato (mesmo de w2pp-OpenWyd-WebClient/tools/create_test_account.mjs):
// POST /api/signup {name, password}; name 4..12 [A-Za-z0-9]; o protocolo leva no máximo 12 bytes
// de senha, então geramos 10. O PIN é definido na 1ª verificação.
import { randomInt } from 'node:crypto';

export const DEFAULT_PORTAL = 'https://wyd-ten.vercel.app';

const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export const randomFrom = (alphabet: string, n: number) => Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join('');
export const mask = (s: string) => s.slice(0, 4) + '*'.repeat(Math.max(0, s.length - 4));

export interface NewAccount {
  account: string;
  password: string;
  pin: string;
}

export class SignupError extends Error {}

/** Cria uma conta comum de jogador. O PIN é só gerado aqui; o servidor o grava no 1º login. */
export async function signupAccount(portal = DEFAULT_PORTAL, pin = randomFrom('0123456789', 6)): Promise<NewAccount> {
  const account = `bot${randomFrom('0123456789', 7)}`;
  const password = randomFrom(ALNUM, 10);
  const res = await fetch(new URL('/api/signup', portal), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: account, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new SignupError(`POST /api/signup -> ${res.status} conta=${mask(account)} erro=${body?.error ?? '?'}`);
  }
  return { account, password, pin };
}
