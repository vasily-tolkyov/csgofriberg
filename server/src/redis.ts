import { createClient, RedisClientType } from 'redis';
import { config } from './config';

type Client = RedisClientType<any, any, any, 2>;

let commandClient: Client | null = null;
let available = false;
const errorLogTimes = new Map<string, number>();
const commandScriptShas = new Map<string, string>();
const commandScriptLoads = new Map<string, Promise<string>>();

function logClientError(label: string, err: unknown): void {
  const now = Date.now();
  const previous = errorLogTimes.get(label) ?? 0;
  if (now - previous < 5_000) return;
  errorLogTimes.set(label, now);
  console.error(`[redis:${label}]`, err instanceof Error ? err.message : err);
}

function attachClientEvents(client: Client, label: string): Client {
  client.on('error', (err) => {
    available = false;
    logClientError(label, err);
  });
  client.on('ready', () => {
    available = true;
  });
  return client;
}

function makeClient(label: string): Client {
  return attachClientEvents(
    createClient({
      url: config.redisUrl,
      RESP: 2,
      socket: {
        connectTimeout: config.redisCommandTimeoutMs,
        reconnectStrategy: false,
      },
    }) as Client,
    label
  );
}

export function redisKey(key: string): string {
  return `${config.redisPrefix}${key}`;
}

export async function initRedis(): Promise<boolean> {
  if (commandClient?.isReady) return true;
  commandClient = makeClient('command');
  try {
    await commandClient.connect();
    available = true;
    console.log(`[redis] connected: ${config.redisUrl}`);
    return true;
  } catch (err) {
    available = false;
    await closeRedis();
    if (config.redisRequired) throw err;
    console.warn('[redis] unavailable, single-instance fallback enabled');
    return false;
  }
}

export function isRedisAvailable(): boolean {
  return available && Boolean(commandClient?.isReady);
}

export function redis(): Client | null {
  if (!isRedisAvailable() || !commandClient) return null;
  return commandClient.withCommandOptions({ timeout: config.redisCommandTimeoutMs }) as Client;
}

async function evalCachedScript(
  client: Client,
  name: string,
  script: string,
  keys: string[],
  args: string[],
  shas: Map<string, string>,
  loads: Map<string, Promise<string>>
): Promise<unknown> {
  const load = async (force = false): Promise<string> => {
    if (!force) {
      const cached = shas.get(name);
      if (cached) return cached;
    } else {
      shas.delete(name);
    }
    const existing = loads.get(name);
    if (existing) return existing;
    const pending = client.scriptLoad(script)
      .then((sha) => {
        shas.set(name, sha);
        return sha;
      })
      .finally(() => loads.delete(name));
    loads.set(name, pending);
    return pending;
  };

  let sha = await load();
  try {
    return await client.evalSha(sha, { keys, arguments: args });
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('NOSCRIPT')) throw err;
    sha = await load(true);
    return client.evalSha(sha, { keys, arguments: args });
  }
}

export async function evalCommandScript(
  name: string,
  script: string,
  keys: string[],
  args: string[]
): Promise<unknown> {
  const client = redis();
  if (!client) throw new Error('REDIS_UNAVAILABLE');
  return evalCachedScript(
    client,
    name,
    script,
    keys,
    args,
    commandScriptShas,
    commandScriptLoads
  );
}

export async function closeRedis(): Promise<void> {
  if (commandClient?.isOpen) {
    await commandClient.quit().catch(() => undefined);
  }
  commandClient = null;
  available = false;
  commandScriptShas.clear();
  commandScriptLoads.clear();
}
