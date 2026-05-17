/**
 * Chat action-envelope handling.
 *
 * The chat system prompt invites the model to optionally append a structured
 * action envelope after its prose answer, prefixed with the sentinel
 * `<<<ACTIONS:` followed by a JSON object `{ "suggestions": [...] }`.
 *
 * On the wire we strip that envelope from the forwarded text stream (so users
 * see only the prose) and emit it separately as an SSE `event: actions` frame.
 *
 * This file exports:
 *   - createActionStripper(): a small state machine that buffers text deltas
 *     and decides what to forward vs. what to hold as the envelope tail.
 *   - parseActionEnvelope(text): tolerant parser that returns
 *     { suggestions: AISuggestion[] } | null. Drops malformed entries.
 */

const SENTINEL = '<<<ACTIONS:';

/**
 * Build a streaming stripper that detects the SENTINEL across chunk boundaries.
 *
 * Usage:
 *   const s = createActionStripper();
 *   while (chunks) s.push(text) // returns forwardable text, possibly ''
 *   const { forward, envelope } = s.flush()
 */
function createActionStripper() {
  let buffer = '';
  let envelope = '';
  let inEnvelope = false;

  function push(text) {
    if (!text) return '';
    if (inEnvelope) {
      envelope += text;
      return '';
    }
    buffer += text;

    const idx = buffer.indexOf(SENTINEL);
    if (idx >= 0) {
      const forward = buffer.slice(0, idx);
      envelope = buffer.slice(idx + SENTINEL.length);
      buffer = '';
      inEnvelope = true;
      return forward;
    }

    // Hold back the last (SENTINEL.length - 1) chars so a sentinel split
    // across chunk boundaries is still detected on the next push.
    const safeEnd = Math.max(0, buffer.length - (SENTINEL.length - 1));
    if (safeEnd === 0) return '';
    const forward = buffer.slice(0, safeEnd);
    buffer = buffer.slice(safeEnd);
    return forward;
  }

  function flush() {
    if (inEnvelope) {
      return { forward: '', envelope };
    }
    const forward = buffer;
    buffer = '';
    return { forward, envelope: null };
  }

  return { push, flush };
}

/**
 * Lenient parser. Accepts the raw envelope text the model produced after
 * `<<<ACTIONS:` (with surrounding whitespace or markdown code fences) and
 * returns a normalised payload or null on any failure.
 *
 * Each kept suggestion is assigned a fresh server-generated id so the client
 * can dedup across messages.
 */
function parseActionEnvelope(text, idPrefix = 'chat') {
  if (!text || typeof text !== 'string') return null;
  let s = text.trim();
  if (!s) return null;
  // Strip a leading ``` or ```json fence and trailing ``` if the model wrapped
  // the JSON in a code block.
  s = s.replace(/^```(?:json)?\s*/i, '').trim();
  s = s.replace(/```\s*$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(s);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.suggestions)) {
    return null;
  }

  const stamp = Date.now();
  const out = [];
  for (let i = 0; i < parsed.suggestions.length; i++) {
    const sg = parsed.suggestions[i];
    if (!sg || typeof sg !== 'object') continue;
    if (typeof sg.reason !== 'string' || !sg.reason.trim()) continue;
    const action = normaliseAction(sg.action);
    if (!action) continue;
    out.push({
      id: `${idPrefix}-${stamp}-${i}`,
      reason: sg.reason.trim(),
      action,
    });
  }
  return out.length > 0 ? { suggestions: out } : null;
}

/**
 * Validate the model-provided action and return a clean copy. Returns null
 * for any unknown type or missing required field.
 */
function normaliseAction(a) {
  if (!a || typeof a !== 'object' || typeof a.type !== 'string') return null;
  switch (a.type) {
    case 'excludeCluster':
      return typeof a.clusterName === 'string' && a.clusterName.trim()
        ? { type: 'excludeCluster', clusterName: a.clusterName.trim() }
        : null;
    case 'excludeByResourcePoolPattern':
      return typeof a.pattern === 'string' && a.pattern.trim()
        ? { type: 'excludeByResourcePoolPattern', pattern: a.pattern.trim() }
        : null;
    case 'excludeByVMNamePattern':
      return typeof a.pattern === 'string' && a.pattern.trim()
        ? { type: 'excludeByVMNamePattern', pattern: a.pattern.trim() }
        : null;
    case 'forceIncludeVM':
      return typeof a.vmName === 'string' && a.vmName.trim()
        ? { type: 'forceIncludeVM', vmName: a.vmName.trim() }
        : null;
    case 'excludeVM':
      return typeof a.vmName === 'string' && a.vmName.trim()
        ? { type: 'excludeVM', vmName: a.vmName.trim() }
        : null;
    default:
      return null;
  }
}

module.exports = {
  SENTINEL,
  createActionStripper,
  parseActionEnvelope,
};
