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

function proxyUrl(u: string) {
  return `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://t.me/${u}`)}`;
}

interface ParsedPage {
  ogTitle: string; ogDesc: string; ogImage: string;
  tgName: string;  tgDesc: string; tgPhoto: string;
}

function parsePage(html: string): ParsedPage {
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

function checkNotExist(p: ParsedPage): boolean {
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
    if (!html.includes('tgme_')) return null; // codetabs error page

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

export async function validateBatch(
  usernames: string[],
  onResult: (result: ValidationResult | null, username: string) => void,
  signal?: AbortSignal,
): Promise<void> {
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
}
