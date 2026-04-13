export interface ValidationResult {
  username: string;
  status: 'verified' | 'not_exist';
  type: 'user' | 'bot' | 'group' | 'channel';
  displayName: string;
  bio: string;
  avatar: string;
}

const CONCURRENCY_PER_TOKEN = 1;   // 1 поток на токен — безопасно для TG
const PROXY_CONCURRENCY     = 3;
const BOT_TIMEOUT_MS        = 8000;
const PROXY_TIMEOUT_MS      = 12000;
const BATCH_DELAY_MS        = 1200;
const MAX_RETRIES           = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        active++;
        try { resolve(await fn()); } catch (err) { reject(err); } finally {
          active--;
          if (queue.length > 0) queue.shift()!();
        }
      };
      if (active < concurrency) run(); else queue.push(run);
    });
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

// ── Token Pool ────────────────────────────────────────────────────────────────

export class TokenPool {
  private tokens: Array<{ token: string; cooldownUntil: number }>;
  private idx = 0;

  constructor(tokens: string[]) {
    const valid = tokens.filter((t) => /^\d{5,12}:[A-Za-z0-9_-]{35,}$/.test(t.trim()));
    this.tokens = valid.map((token) => ({ token, cooldownUntil: 0 }));
  }

  get size() { return this.tokens.length; }

  next(): string {
    const now = Date.now();
    for (let i = 0; i < this.tokens.length; i++) {
      const t = this.tokens[(this.idx + i) % this.tokens.length];
      if (t.cooldownUntil <= now) {
        this.idx = (this.idx + 1) % this.tokens.length;
        return t.token;
      }
    }
    const best = this.tokens.reduce((a, b) => (a.cooldownUntil < b.cooldownUntil ? a : b));
    this.idx = (this.idx + 1) % this.tokens.length;
    return best.token;
  }

  setCooldown(token: string, ms: number) {
    const t = this.tokens.find((t) => t.token === token);
    if (t) t.cooldownUntil = Math.max(t.cooldownUntil, Date.now() + ms);
  }

  minWait(): number {
    if (this.tokens.length === 0) return 0;
    const now = Date.now();
    return Math.max(0, Math.min(...this.tokens.map((t) => t.cooldownUntil)) - now);
  }
}

// ── Bot API ───────────────────────────────────────────────────────────────────

interface RateLimitResult { rateLimited: true; retryAfterMs: number }
type BotResult = ValidationResult | 'not_found' | RateLimitResult;

function isRateLimited(r: BotResult): r is RateLimitResult {
  return typeof r === 'object' && r !== null && 'rateLimited' in r;
}

async function checkViaBotAPI(
  username: string,
  token: string,
  signal?: AbortSignal,
): Promise<BotResult> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), BOT_TIMEOUT_MS);
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getChat?chat_id=@${username}`,
      { signal: ctrl.signal },
    );
    clearTimeout(timer);

    if (res.status === 429) {
      let retryAfterMs = 3000;
      try {
        const body = await res.json() as { parameters?: { retry_after?: number } };
        const secs = body?.parameters?.retry_after;
        if (typeof secs === 'number' && secs > 0) retryAfterMs = secs * 1000 + 200;
      } catch { /* ignore */ }
      return { rateLimited: true, retryAfterMs };
    }

    const data = await res.json() as {
      ok: boolean;
      result?: {
        type: string; is_bot?: boolean;
        first_name?: string; last_name?: string;
        title?: string; bio?: string; description?: string;
      };
    };

    if (data.ok && data.result) {
      const chat = data.result;
      let type: ValidationResult['type'];
      if (chat.type === 'private')      type = chat.is_bot ? 'bot' : 'user';
      else if (chat.type === 'channel') type = 'channel';
      else                              type = 'group';
      return {
        username, status: 'verified', type,
        displayName: chat.type === 'private'
          ? [chat.first_name, chat.last_name].filter(Boolean).join(' ')
          : (chat.title ?? ''),
        bio: chat.bio ?? chat.description ?? '',
        avatar: '',
      };
    }
    return 'not_found';
  } catch {
    clearTimeout(timer);
    return 'not_found';
  }
}

// ── Proxy (codetabs → t.me) ───────────────────────────────────────────────────

function proxyUrl(u: string) {
  return `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://t.me/${u}`)}`;
}

function parsePage(html: string) {
  return {
    ogTitle: html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1]?.trim()   ?? '',
    ogDesc:  html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1]?.trim() ?? '',
    ogImage: html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1]?.trim()   ?? '',
    tgName:  html.match(/<div[^>]+class="tgme_page_title"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]
               ?.replace(/<[^>]+>/g, '').trim() ?? '',
    tgDesc:  html.match(/<div[^>]+class="tgme_page_description"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
               ?.replace(/<[^>]+>/g, '').trim() ?? '',
    tgPhoto: html.match(/<img[^>]+class="tgme_page_photo_image"[^>]*\bsrc="([^"]+)"/i)?.[1]
          ?? html.match(/<img[^>]+\bsrc="([^"]+)"[^>]*class="tgme_page_photo_image"/i)?.[1]
          ?? '',
  };
}

function checkNotExist(p: ReturnType<typeof parsePage>): boolean {
  const genericImage = !p.ogImage || p.ogImage.includes('telegram.org/img/');
  const genericTitle = !p.ogTitle
    || p.ogTitle.toLowerCase() === 'telegram'
    || p.ogTitle.toLowerCase().startsWith('telegram:');
  return genericImage && genericTitle;
}

function detectType(username: string, html: string): ValidationResult['type'] {
  if (username.endsWith('bot'))                                                                      return 'bot';
  if (/join\s+channel/i.test(html))                                                                 return 'channel';
  if (/join\s+group/i.test(html) || /\d[\d\s,]*\s*(?:subscribers?|members?|участник)/i.test(html)) return 'group';
  return 'user';
}

async function checkViaProxy(username: string, signal?: AbortSignal): Promise<ValidationResult | null> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT_MS);
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(proxyUrl(username), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    if (!html.includes('tgme_')) return null;

    const p = parsePage(html);
    if (checkNotExist(p)) {
      return { username, status: 'not_exist', type: detectType(username, html), displayName: '', bio: '', avatar: '' };
    }
    const hasRealImage = !!p.ogImage && !p.ogImage.includes('telegram.org/img/');
    return {
      username, status: 'verified', type: detectType(username, html),
      displayName: p.tgName || p.ogTitle,
      bio: p.tgDesc || p.ogDesc,
      avatar: p.tgPhoto || (hasRealImage ? p.ogImage : ''),
    };
  } catch (err) {
    clearTimeout(timer);
    if (signal?.aborted) throw err;
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function validateBatch(
  usernames: string[],
  tokens: string[],
  onResult: (result: ValidationResult | null, username: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const pool     = new TokenPool(tokens);
  const hasTokens = pool.size > 0;

  // ── Без токенов: оригинальный батчинг (безопасно для codetabs) ──────────
  if (!hasTokens) {
    for (let i = 0; i < usernames.length; i += PROXY_CONCURRENCY) {
      if (signal?.aborted) break;
      if (i > 0) {
        try { await sleep(BATCH_DELAY_MS, signal); } catch { break; }
        if (signal?.aborted) break;
      }
      const batch = usernames.slice(i, i + PROXY_CONCURRENCY);
      await Promise.all(
        batch.map(async (u) => {
          if (signal?.aborted) return;
          try {
            const result = await checkViaProxy(u, signal);
            onResult(result, u);
          } catch {
            if (!signal?.aborted) onResult(null, u);
          }
        }),
      );
    }
    return;
  }

  // ── Фаза 1: Bot API параллельно ─────────────────────────────────────────
  // Каналы/группы/боты → onResult сразу.
  // Обычные юзеры (not_found) → собираем в proxyNeeded, слот сразу освобождается.
  const botLimit   = createLimiter(CONCURRENCY_PER_TOKEN * pool.size);
  const proxyNeeded: string[] = [];

  await Promise.all(
    usernames.map((u) =>
      botLimit(async () => {
        if (signal?.aborted) return;

        // Равномерно распределяем старт запросов по времени
        await sleep(Math.random() * 500).catch(() => {});
        if (signal?.aborted) return;

        let retries = 0;
        while (retries < MAX_RETRIES) {
          if (signal?.aborted) return;
          const wait = pool.minWait();
          if (wait > 0) { try { await sleep(wait, signal); } catch { return; } }
          if (signal?.aborted) return;

          const token     = pool.next();
          const botResult = await checkViaBotAPI(u, token, signal);
          if (signal?.aborted) return;

          if (isRateLimited(botResult)) {
            pool.setCooldown(token, botResult.retryAfterMs);
            retries++;
            // Ждём перед повтором чтобы не бить сразу
            try { await sleep(botResult.retryAfterMs, signal); } catch { return; }
            continue;
          }

          if (botResult !== 'not_found') {
            onResult(botResult, u);
            return;
          }

          // not_found → нужен proxy, освобождаем слот Bot API
          proxyNeeded.push(u);
          return;
        }

        proxyNeeded.push(u);
      }),
    ),
  );

  // ── Фаза 2: Proxy батчами (проверенный безопасный темп) ──────────────────
  for (let i = 0; i < proxyNeeded.length; i += PROXY_CONCURRENCY) {
    if (signal?.aborted) break;
    if (i > 0) {
      try { await sleep(BATCH_DELAY_MS, signal); } catch { break; }
      if (signal?.aborted) break;
    }
    const batch = proxyNeeded.slice(i, i + PROXY_CONCURRENCY);
    await Promise.all(
      batch.map(async (u) => {
        if (signal?.aborted) return;
        try {
          const result = await checkViaProxy(u, signal);
          onResult(result, u);
        } catch {
          if (!signal?.aborted) onResult(null, u);
        }
      }),
    );
  }
}
