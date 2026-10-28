import assert from 'node:assert/strict';
import { createAutoSummarizer } from '../src/auto-summarize.js';

const added = [];
const msgs = Array.from({ length: 6 }, (_, i) => ({ time: i + 1, text: 'm' + i, sender: 'a' }));
const auto = createAutoSummarizer({
  summarize: async () => [{ text: '一条记忆', level: 'normal', speaker_id: '1' }],
  store: { add: async (x) => { added.push(x); } },
  getMessages: () => msgs,
  every: 3,
});
assert.equal(auto.tick('k'), false);
assert.equal(auto.tick('k'), false);
assert.equal(auto.tick('k'), true);
await new Promise((r) => setTimeout(r, 20));
assert.equal(added.length, 1);
assert.equal(added[0].scope, 'k');
console.log('自动沉淀 通过');
