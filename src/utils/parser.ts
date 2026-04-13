/**
 * Smart Import Parser
 * Extracts @usernames and t.me/ links from any text/CSV input.
 * Handles multiple usernames per line separated by spaces, commas, or other delimiters.
 * Ignores emails, dates, and other non-username tokens.
 */

// Telegram username: 5–32 chars, letters/digits/underscores, starts with letter
const TG_USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;

// t.me path segments that are not real usernames
const TG_SKIP_PATHS = new Set([
  's', 'share', 'addstickers', 'joinchat', 'invite', 'proxy', 'setlanguage', 'bg', 'iv',
]);

export function extractUsernames(raw: string): string[] {
  const results = new Set<string>();

  const add = (u: string) => {
    const lower = u.toLowerCase();
    if (TG_USERNAME_RE.test(u) && !TG_SKIP_PATHS.has(lower)) {
      results.add(lower);
    }
  };

  // 1. @username patterns (prevents matching emails like user@domain.com)
  //    Handles multiple per line: "@alice @bob @carol" — all get matched
  const atRegex = /(?<![a-zA-Z0-9._%+-])@([a-zA-Z][a-zA-Z0-9_]{4,31})\b/g;
  let m: RegExpExecArray | null;
  while ((m = atRegex.exec(raw)) !== null) {
    add(m[1]);
  }

  // 2. t.me/username and telegram.me/username links
  //    Uses lookahead so the trailing separator is not consumed.
  //    The `m` flag makes `$` match end-of-line, covering links at line end.
  const linkRegex = /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([a-zA-Z][a-zA-Z0-9_]{4,31})(?=[/\s,;)\]"']|$)/gim;
  while ((m = linkRegex.exec(raw)) !== null) {
    add(m[1]);
  }

  // 3. Bare usernames (no @ prefix) — extract from lines that look like username lists.
  //    Strategy: split each line into tokens; if ≥70% of tokens match the Telegram
  //    username pattern, treat the whole line as a list and extract all matches.
  //    This handles "user1, user2, user3" and "user1 user2 user3" while avoiding
  //    false positives from natural-language sentences.
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Split by common list separators: whitespace, comma, semicolon, pipe, tab
    const tokens = trimmed
      .split(/[\s,;|\t]+/)
      .map((t) => t.replace(/^[^a-zA-Z@]+/, '').replace(/[^a-zA-Z0-9_]+$/, ''))
      .filter(Boolean);

    if (tokens.length === 0) continue;

    // Collect tokens that match the username pattern (with or without leading @)
    const candidates = tokens.filter((t) => {
      const clean = t.startsWith('@') ? t.slice(1) : t;
      return TG_USERNAME_RE.test(clean);
    });

    // Only extract if the line is predominantly username-like (≥70%)
    if (candidates.length / tokens.length >= 0.7) {
      for (const t of candidates) {
        const clean = t.startsWith('@') ? t.slice(1) : t;
        add(clean);
      }
    }
  }

  return Array.from(results);
}

/**
 * Determine contact type from username
 */
export function guessType(username: string): 'bot' | 'user' {
  return username.toLowerCase().endsWith('bot') ? 'bot' : 'user';
}
