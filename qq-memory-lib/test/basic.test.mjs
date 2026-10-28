import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createVectorStore, createNotes, createProfiles, createMode, summarizeDialogue } from '../src/index.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qml-'));
// 假 embedding：按关键词生成向量，免网络
const embed = async (texts) => texts.map((t) => [/猫/.test(t) ? 1 : 0, /考试/.test(t) ? 1 : 0, 0.01]);

// 向量记忆 + 隔离
const vs = createVectorStore({ file: path.join(dir, 'm.json'), embed });
const priv = createMode('private', { sessionId: '1' });
const grp = createMode('group', { sessionId: '9' });
await vs.add({ scope: priv.scope, summary: '主人养了一只猫', level: 'important' });
await vs.add({ scope: grp.scope, summary: '群里聊到猫粮' });
await vs.add({ scope: 'group:other', summary: '别的群也有猫' });
assert.equal((await vs.recall('猫', { scopes: priv.canRead })).length, 1, '私聊只读自己');
assert.equal((await vs.recall('猫', { scopes: grp.canRead })).length, 1, '群聊只读本群');
const id = await vs.add({ scope: priv.scope, summary: '主人养了一只猫' });
assert.equal(vs.load().items.filter((m) => m.scope === priv.scope).length, 1, '重复记忆被去重');
assert.equal(grp.speakerFor('unknown'), null);
assert.equal(priv.speakerFor('unknown'), '1');

// 压缩：假 chat
const text = '#1 [t] 小明(100): 我下周三考试\n#2 [t] 助手(bot): 加油';
const r = await summarizeDialogue(text, { botName: '助手', botId: 'bot', chat: async () => '[{"text":"小明下周三考试","evidence":[1],"level":"important"},{"text":"无依据","evidence":[]},{"text":"助手说加油","evidence":[2]}]' });
assert.deepEqual(r.map((x) => x.speaker), ['100'], '无依据与bot发言被丢弃');

// 好感分
const n = createNotes({ dir, ownerId: 'owner', initial: { a: { name: 'A', score: 10 } } });
assert.equal(n.set({ id: 'a', delta: -2, type: '下流话', quote: 'x' }).warnedOnly, true, '首次只提醒');
assert.equal(n.set({ id: 'a', delta: -2, type: '下流话', quote: 'x' }).after, 8, '第二次才扣');
assert.equal(n.set({ id: 'a', delta: 1, type: '态度变好', quote: 'x' }).ok, false, '不可回查的加分被拒');
assert.equal(n.restart({ id: 'a', reason: '太短' }).ok, false);
assert.equal(n.restart({ id: 'a', reason: '这三天他纠正了两处事实错误，且没有讨好行为，不像表演' }).after, 13);
assert.equal(n.restart({ id: 'a', reason: '这三天他纠正了两处事实错误，且没有讨好行为，不像表演' }).ok, false, '7天一次');

// 画像
const p = createProfiles({ dir });
assert.equal(p.add({ id: '100', kind: 'good', quote: '原话', fact: '纠正了错误' }).ok, true);
assert.equal(p.add({ id: '100', kind: 'good', quote: '原话', fact: 'x', tier: 'core' }).ok, false);
console.log('全部通过');
fs.rmSync(dir, { recursive: true, force: true });
