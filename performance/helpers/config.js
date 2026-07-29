/**
 * Shared env + flags for LiturgyFlow performance suite.
 * 1 VU ≈ 1 virtual church (may spawn multiple role-shaped request mixes).
 */
export const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export const SUPABASE_URL = (__ENV.SUPABASE_URL || '').replace(/\/$/, '');
export const SUPABASE_ANON_KEY =
  __ENV.SUPABASE_ANON_KEY ||
  __ENV.SUPABASE_PUBLISHABLE_KEY ||
  '';

/** Single shared stress account (optional). */
export const STRESS_EMAIL = __ENV.STRESS_EMAIL || '';
export const STRESS_PASSWORD = __ENV.STRESS_PASSWORD || '';

/** Comma-separated access tokens for multi-church auth pool. */
export const STRESS_TOKENS = (__ENV.STRESS_TOKENS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * When "1", allow POST /api/generate (PPT) and AI poster flags.
 * Default off — prevents burning OpenAI/Gemini quota and Render CPU.
 */
export const ALLOW_EXPENSIVE = (__ENV.STRESS_ALLOW_EXPENSIVE || '0') === '1';

/** When "1", include include_ai_mass_poster on generate (requires ALLOW_EXPENSIVE). */
export const ALLOW_AI_POSTER = (__ENV.STRESS_ALLOW_AI_POSTER || '0') === '1';

/** Discover OpenAPI paths and exercise unknown GETs lightly. */
export const AUTO_DISCOVER = (__ENV.STRESS_AUTO_DISCOVER || '1') !== '0';

/** Guest choir practice share (no account). */
export const PRACTICE_TOKEN = (__ENV.PRACTICE_TOKEN || '').trim();
export const PRACTICE_PIN = (__ENV.PRACTICE_PIN || '').trim();

export const REPORT_DIR = 'performance/reports';

export function envSummary() {
  return {
    BASE_URL,
    hasSupabase: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
    hasPasswordAuth: Boolean(STRESS_EMAIL && STRESS_PASSWORD),
    tokenPoolSize: STRESS_TOKENS.length,
    ALLOW_EXPENSIVE,
    ALLOW_AI_POSTER,
    AUTO_DISCOVER,
    hasPracticeToken: Boolean(PRACTICE_TOKEN),
  };
}
