const test = require('node:test');
const assert = require('node:assert/strict');
const { createActionStripper, parseActionEnvelope } = require('./actionEnvelope');

test('createActionStripper: text without sentinel forwards everything on flush', () => {
  const s = createActionStripper();
  let out = '';
  out += s.push('Hello ');
  out += s.push('world');
  const { forward, envelope } = s.flush();
  out += forward;
  assert.equal(out, 'Hello world');
  assert.equal(envelope, null);
});

test('createActionStripper: holds back a tail in case sentinel arrives', () => {
  const s = createActionStripper();
  // Short input shorter than sentinel length must be held back entirely.
  const out1 = s.push('abc');
  assert.equal(out1, '');
  const { forward, envelope } = s.flush();
  assert.equal(forward, 'abc');
  assert.equal(envelope, null);
});

test('createActionStripper: sentinel in a single chunk', () => {
  const s = createActionStripper();
  const out = s.push('prose answer\n<<<ACTIONS:\n{"suggestions":[]}');
  assert.equal(out, 'prose answer\n');
  const { forward, envelope } = s.flush();
  assert.equal(forward, '');
  assert.equal(envelope.trim(), '{"suggestions":[]}');
});

test('createActionStripper: sentinel split across chunk boundaries', () => {
  const s = createActionStripper();
  let out = '';
  out += s.push('prose answer\n<<<AC');
  out += s.push('TIONS:\n{"suggestions":[{"reason":"x","action":{"type":"excludeCluster","clusterName":"C1"}}]}');
  assert.equal(out, 'prose answer\n');
  const { forward, envelope } = s.flush();
  assert.equal(forward, '');
  assert.match(envelope, /"clusterName":"C1"/);
});

test('createActionStripper: text after sentinel keeps accumulating into envelope', () => {
  const s = createActionStripper();
  s.push('intro\n<<<ACTIONS:\n{"sugg');
  s.push('estions":[]}');
  const { envelope } = s.flush();
  assert.equal(envelope.trim(), '{"suggestions":[]}');
});

test('createActionStripper: many small chunks behave like one large chunk', () => {
  const s = createActionStripper();
  const full = 'Here is the answer.\n<<<ACTIONS:\n{"suggestions":[]}';
  let out = '';
  for (const ch of full) out += s.push(ch);
  const { forward, envelope } = s.flush();
  out += forward;
  assert.equal(out, 'Here is the answer.\n');
  assert.equal(envelope.trim(), '{"suggestions":[]}');
});

test('parseActionEnvelope: valid envelope with one excludeCluster', () => {
  const env = '{"suggestions":[{"reason":"restore landing zone","action":{"type":"excludeCluster","clusterName":"C2"}}]}';
  const out = parseActionEnvelope(env);
  assert.equal(out.suggestions.length, 1);
  assert.equal(out.suggestions[0].reason, 'restore landing zone');
  assert.deepEqual(out.suggestions[0].action, { type: 'excludeCluster', clusterName: 'C2' });
  assert.match(out.suggestions[0].id, /^chat-\d+-0$/);
});

test('parseActionEnvelope: tolerates markdown code fences', () => {
  const env = '```json\n{"suggestions":[{"reason":"r","action":{"type":"excludeVM","vmName":"vm-1"}}]}\n```';
  const out = parseActionEnvelope(env);
  assert.equal(out.suggestions.length, 1);
  assert.deepEqual(out.suggestions[0].action, { type: 'excludeVM', vmName: 'vm-1' });
});

test('parseActionEnvelope: drops malformed entries but keeps valid ones', () => {
  const env = JSON.stringify({
    suggestions: [
      { reason: 'ok', action: { type: 'excludeCluster', clusterName: 'C1' } },
      { reason: '', action: { type: 'excludeCluster', clusterName: 'C2' } }, // empty reason → drop
      { reason: 'no action' }, // missing action → drop
      { reason: 'bad type', action: { type: 'rmRf' } }, // unknown type → drop
      { reason: 'missing field', action: { type: 'excludeCluster' } }, // missing clusterName → drop
      { reason: 'r2', action: { type: 'excludeByVMNamePattern', pattern: '^dev-' } },
    ],
  });
  const out = parseActionEnvelope(env);
  assert.equal(out.suggestions.length, 2);
  assert.equal(out.suggestions[0].action.clusterName, 'C1');
  assert.equal(out.suggestions[1].action.pattern, '^dev-');
});

test('parseActionEnvelope: returns null on unparseable JSON', () => {
  assert.equal(parseActionEnvelope('{not json'), null);
  assert.equal(parseActionEnvelope(''), null);
  assert.equal(parseActionEnvelope(null), null);
  assert.equal(parseActionEnvelope('"just a string"'), null);
  assert.equal(parseActionEnvelope('{}'), null); // missing suggestions
  assert.equal(parseActionEnvelope('{"suggestions":[]}'), null); // empty after filtering
});

test('parseActionEnvelope: each kept suggestion has a unique id', () => {
  const env = JSON.stringify({
    suggestions: [
      { reason: 'a', action: { type: 'excludeCluster', clusterName: 'C1' } },
      { reason: 'b', action: { type: 'excludeCluster', clusterName: 'C2' } },
    ],
  });
  const out = parseActionEnvelope(env);
  const ids = out.suggestions.map((s) => s.id);
  assert.equal(new Set(ids).size, 2);
});

test('parseActionEnvelope: trims whitespace from reason and action fields', () => {
  const env = JSON.stringify({
    suggestions: [
      { reason: '  trimmed  ', action: { type: 'excludeCluster', clusterName: '  C1  ' } },
    ],
  });
  const out = parseActionEnvelope(env);
  assert.equal(out.suggestions[0].reason, 'trimmed');
  assert.equal(out.suggestions[0].action.clusterName, 'C1');
});
