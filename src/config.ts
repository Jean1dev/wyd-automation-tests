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

export function loadConfig(): BotConfig {
  const pin = need('WYD_PIN');
  if (!/^\d{6}$/.test(pin)) throw new Error('WYD_PIN deve ter 6 dígitos');
  return {
    target: process.env.WYD_TARGET?.trim() || 'reseau.proxy.rlwy.net:56950',
    clientVersion: Number(process.env.WYD_CLIENT_VERSION ?? 12000),
    account: need('WYD_ACCOUNT'),
    password: need('WYD_PASSWORD'),
    pin,
    charPrefix: process.env.WYD_CHAR_PREFIX?.trim() || 'bot',
    charClass: Number(process.env.WYD_CHAR_CLASS ?? 0),
  };
}
