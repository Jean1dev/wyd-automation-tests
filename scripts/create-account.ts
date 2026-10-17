// Cria uma conta comum de jogador no portal do operador e grava as credenciais
// geradas só no .env (ignorado pelo Git). Nada secreto é impresso.
//
// Contrato (mesmo de w2pp-OpenWyd-WebClient/tools/create_test_account.mjs):
// POST /api/signup {name, password}; name 4..12 [A-Za-z0-9]; o protocolo leva
// no máximo 12 bytes de senha, então geramos 10. O PIN é definido na 1ª verificação.
//
// Uso: npm run account:create [-- --portal https://wyd-ten.vercel.app]
//      npm run account:create -- --second   # segunda conta (WYD_ACCOUNT_B/WYD_PASSWORD_B), para a troca
//      npm run account:create -- --arch     # conta do cenário do Arch (WYD_ACCOUNT_ARCH/WYD_PASSWORD_ARCH), que precisa de slot livre
import { randomInt } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ENV = resolve(ROOT, '.env');
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const random = (alphabet: string, n: number) => Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join('');
const mask = (s: string) => s.slice(0, 4) + '*'.repeat(Math.max(0, s.length - 4));

const i = process.argv.indexOf('--portal');
const portal = i >= 0 ? process.argv[i + 1] : 'https://wyd-ten.vercel.app';
const sfx = process.argv.includes('--second') ? '_B' : process.argv.includes('--arch') ? '_ARCH' : '';

if (!existsSync(ENV)) copyFileSync(resolve(ROOT, '.env.example'), ENV);
const current = Object.fromEntries(
  readFileSync(ENV, 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
if (current[`WYD_ACCOUNT${sfx}`]) {
  console.error(`WYD_ACCOUNT${sfx} já está preenchido no .env; não vou criar outra conta.`);
  process.exit(2);
}

const name = `bot${random('0123456789', 7)}`;
const password = random(ALNUM, 10);
const res = await fetch(new URL('/api/signup', portal), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name, password }),
});
const body = (await res.json().catch(() => null)) as { error?: string } | null;
console.log(`POST /api/signup -> ${res.status} conta=${mask(name)}${res.ok ? '' : ` erro=${body?.error ?? '?'}`}`);
if (!res.ok) process.exit(1);

// O dotenv fica com a primeira ocorrência de cada chave, então preenchemos as linhas no lugar.
let text = readFileSync(ENV, 'utf8');
const set = (k: string, v: string) => {
  const re = new RegExp(`^${k}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, `${k}=${v}`) : `${text.trimEnd()}\n${k}=${v}\n`;
};
set(`WYD_ACCOUNT${sfx}`, name);
set(`WYD_PASSWORD${sfx}`, password);
if (!current.WYD_PIN) set('WYD_PIN', random('0123456789', 6));
writeFileSync(ENV, text);
console.log(`.env: WYD_ACCOUNT${sfx}, WYD_PASSWORD${sfx}${current.WYD_PIN ? '' : ' e WYD_PIN'} preenchidos`);
