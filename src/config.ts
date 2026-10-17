import { config as loadEnv } from 'dotenv';
import type { Credentials } from './bot/session.ts';

loadEnv({ quiet: true });

function need(k: string): string {
  const v = process.env[k]?.trim();
  if (!v) throw new Error(`variável ${k} ausente no .env (veja .env.example)`);
  return v;
}

export interface BotConfig extends Credentials {
  charPrefix: string;
  charClass: number;
}

/**
 * Configuração de uma conta do .env. A conta principal usa WYD_ACCOUNT/WYD_PASSWORD/WYD_PIN; a
 * segunda (cenários com dois jogadores) usa WYD_ACCOUNT_B/WYD_PASSWORD_B e WYD_PIN_B, a do
 * cenário do Arch usa WYD_ACCOUNT_ARCH/WYD_PASSWORD_ARCH e WYD_PIN_ARCH, e a do cenário da
 * Magia Negra usa WYD_ACCOUNT_FOEMA/WYD_PASSWORD_FOEMA e WYD_PIN_FOEMA. Os PINs caem no WYD_PIN
 * quando vazios.
 */
export function loadConfig(which: 'a' | 'b' | 'arch' | 'foema' = 'a'): BotConfig {
  const sfx = which === 'b' ? '_B' : which === 'arch' ? '_ARCH' : which === 'foema' ? '_FOEMA' : '';
  const pin = sfx && !process.env[`WYD_PIN${sfx}`]?.trim() ? need('WYD_PIN') : need(`WYD_PIN${sfx}`);
  if (!/^\d{6}$/.test(pin)) throw new Error(`WYD_PIN${sfx} deve ter 6 dígitos`);
  return {
    target: process.env.WYD_TARGET?.trim() || 'reseau.proxy.rlwy.net:56950',
    clientVersion: Number(process.env.WYD_CLIENT_VERSION ?? 12000),
    account: need(`WYD_ACCOUNT${sfx}`),
    password: need(`WYD_PASSWORD${sfx}`),
    pin,
    charPrefix: process.env.WYD_CHAR_PREFIX?.trim() || 'bot',
    charClass: Number(process.env.WYD_CHAR_CLASS ?? 0),
  };
}
