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
//      npm run account:create -- --foema    # conta dos cenários de skills da Foema (WYD_ACCOUNT_FOEMA/WYD_PASSWORD_FOEMA)
//      npm run account:create -- --bm       # conta dos cenários de skills do BeastMaster (WYD_ACCOUNT_BM/WYD_PASSWORD_BM)
//      npm run account:create -- --ht       # conta dos cenários de skills da Huntress (WYD_ACCOUNT_HT/WYD_PASSWORD_HT)
//      npm run account:create -- --tk       # conta dos cenários de skills do TransKnight (WYD_ACCOUNT_TK/WYD_PASSWORD_TK)
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_PORTAL, mask, randomFrom, signupAccount, SignupError } from '../src/bot/account.ts';

const ROOT = resolve(import.meta.dirname, '..');
const ENV = resolve(ROOT, '.env');

const i = process.argv.indexOf('--portal');
const portal = i >= 0 ? process.argv[i + 1] : DEFAULT_PORTAL;
const sfx = process.argv.includes('--second') ? '_B' : process.argv.includes('--arch') ? '_ARCH' : process.argv.includes('--foema') ? '_FOEMA' : process.argv.includes('--bm') ? '_BM' : process.argv.includes('--ht') ? '_HT' : process.argv.includes('--tk') ? '_TK' : '';

if (!existsSync(ENV)) copyFileSync(resolve(ROOT, '.env.example'), ENV);
const current = Object.fromEntries(
  readFileSync(ENV, 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
if (current[`WYD_ACCOUNT${sfx}`]) {
  console.error(`WYD_ACCOUNT${sfx} já está preenchido no .env; não vou criar outra conta.`);
  process.exit(2);
}

let name: string;
let password: string;
try {
  ({ account: name, password } = await signupAccount(portal));
} catch (e) {
  if (!(e instanceof SignupError)) throw e;
  console.log(e.message);
  process.exit(1);
}
console.log(`POST /api/signup -> ok conta=${mask(name)}`);

// O dotenv fica com a primeira ocorrência de cada chave, então preenchemos as linhas no lugar.
let text = readFileSync(ENV, 'utf8');
const set = (k: string, v: string) => {
  const re = new RegExp(`^${k}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, `${k}=${v}`) : `${text.trimEnd()}\n${k}=${v}\n`;
};
set(`WYD_ACCOUNT${sfx}`, name);
set(`WYD_PASSWORD${sfx}`, password);
if (!current.WYD_PIN) set('WYD_PIN', randomFrom('0123456789', 6));
writeFileSync(ENV, text);
console.log(`.env: WYD_ACCOUNT${sfx}, WYD_PASSWORD${sfx}${current.WYD_PIN ? '' : ' e WYD_PIN'} preenchidos`);
