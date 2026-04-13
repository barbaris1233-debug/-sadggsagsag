export interface ValidationResult {
  username: string;
  status: 'verified' | 'not_exist';
  type: 'user' | 'bot' | 'group' | 'channel';
  displayName: string;
  bio: string;
  avatar: string;
}

const PROXY_CONCURRENCY = 3;
const PROXY_TIMEOUT_MS  = 15000;
const BATCH_DELAY_MS    = 1200;
const BOT_TIMEOUT_MS    = 8000;
const BOT_DELAY_MS      = 300;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

// ── Bot API ───────────────────────────────────────────────────────────────────

async function checkViaBotAPI(username: string, token: string, signal?: AbortSignal): Promise<ValidationResult | 'not_found' | 'error'> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), BOT_TIMEOUT_MS);
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=@${username}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.status === 429) return 'error'; // rate limited — skip, proxy will handle
    const data = await res.json() as { ok: boolean; result?: { type: string; is_bot?: boolean; first_name?: string; last_name?: string; title?: string; bio?: string; description?: string } };
    if (!data.ok || !data.result) return 'not_found';
    const chat = data.result;
    let type: ValidationResult['type'];
    if (chat.type === 'private')      type = chat.is_bot ? 'bot' : 'user';
    else if (chat.type === 'channel') type = 'channel';
    else                              type = 'group';
    return {
      username, status: 'verified', type,
      displayName: chat.type === 'private' ? [chat.first_name, chat.last_name].filter(Boolean).join(' ') : (chat.title ?? ''),
      bio: chat.bio ?? chat.description ?? '',
      avatar: '',
    };
  } catch {
    clearTimeout(timer);
    return 'error';
  }
}

// ── Proxy ─────────────────────────────────────────────────────────────────────

function proxyUrl(u: string) {
  return `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://t.me/${u}`)}`;
}

function parsePage(html: string) {
  return {
    ogTitle: html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1]?.trim()   ?? '',
    ogDesc:  html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1]?.trim() ?? '',
    ogImage: html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1]?.trim()   ?? '',
    tgName:  html.match(/<div[^>]+class="tgme_page_title"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '',
    tgDesc:  html.match(/<div[^>]+class="tgme_page_description"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '',
    tgPhoto: html.match(/<img[^>]+class="tgme_page_photo_image"[^>]*\bsrc="([^"]+)"/i)?.[1]
          ?? html.match(/<img[^>]+\bsrc="([^"]+)"[^>]*class="tgme_page_photo_image"/i)?.[1] ?? '',
  };
}

function checkNotExist(p: ReturnType<typeof parsePage>): boolean {
  return (!p.ogImage || p.ogImage.includes('telegram.org/img/')) &&
    (!p.ogTitle || p.ogTitle.toLowerCase() === 'telegram' || p.ogTitle.toLowerCase().startsWith('telegram:'));
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
    if (checkNotExist(p)) return { username, status: 'not_exist', type: detectType(username, html), displayName: '', bio: '', avatar: '' };
    const hasRealImage = !!p.ogImage && !p.ogImage.includes('telegram.org/img/');
    return { username, status: 'verified', type: detectType(username, html), displayName: p.tgName || p.ogTitle, bio: p.tgDesc || p.ogDesc, avatar: p.tgPhoto || (hasRealImage ? p.ogImage : '') };
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
  const validTokens = tokens.filter((t) => /^\d{5,12}:[A-Za-z0-9_-]{35,}$/.test(t.trim()));

  // ── Без токенов: proxy батчами ───────────────────────────────────────────
  if (validTokens.length === 0) {
    for (let i = 0; i < usernames.length; i += PROXY_CONCURRENCY) {
      if (signal?.aborted) break;
      if (i > 0) { try { await sleep(BATCH_DELAY_MS, signal); } catch { break; } }
      await Promise.all(usernames.slice(i, i + PROXY_CONCURRENCY).map(async (u) => {
        if (signal?.aborted) return;
        try { onResult(await checkViaProxy(u, signal), u); } catch { if (!signal?.aborted) onResult(null, u); }
      }));
    }
    return;
  }

  // ── С токенами ───────────────────────────────────────────────────────────
  // Фаза 1: каждый токен берёт свою порцию и проверяет по очереди (1 req за раз)
  // Токены работают параллельно друг другу, но каждый — строго по одному.
  // Результат "not_found" или ошибка → юзер уходит в proxy.
  const proxyNeeded: string[] = [];
  const total = usernames.length;
  let   idx   = 0; // общий счётчик — следующий username для токена

  await Promise.all(
    validTokens.map(async (token) => {
      while (true) {
        if (signal?.aborted) return;
        const i = idx++;
        if (i >= total) return;
        const u = usernames[i];

        const result = await checkViaBotAPI(u, token, signal);
        if (signal?.aborted) return;

        if (result !== 'not_found' && result !== 'error') {
          onResult(result, u);
        } else {
          proxyNeeded.push(u);
        }

        // Пауза между запросами этого токена
        try { await sleep(BOT_DELAY_MS, signal); } catch { return; }
      }
    }),
  );

  if (signal?.aborted) return;

  // Фаза 2: оставшиеся через proxy батчами (тот же проверенный темп)
  for (let i = 0; i < proxyNeeded.length; i += PROXY_CONCURRENCY) {
    if (signal?.aborted) break;
    if (i > 0) { try { await sleep(BATCH_DELAY_MS, signal); } catch { break; } }
    await Promise.all(proxyNeeded.slice(i, i + PROXY_CONCURRENCY).map(async (u) => {
      if (signal?.aborted) return;
      try { onResult(await checkViaProxy(u, signal), u); } catch { if (!signal?.aborted) onResult(null, u); }
    }));
  }
}
