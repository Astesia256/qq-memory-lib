import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEmotionStore, createDiary } from '../src/index.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qml-'));
const chat = async () => '[{"text":"主人提醒我吃饭","valence":0.8,"intensity":0.8,"affection":0.7}]';
const e = createEmotionStore({ dir, chat });
assert.equal(await e.write('x'), 1, '写入1条情感记忆');
assert.ok(e.recallBlock().includes('主人提醒我吃饭'), '能召回');
assert.equal(e.recallBlock(), '', '同一天不重复召回');
assert.equal(e.coreCandidates().length, 1, '强度>=0.75进候选');

const j = createDiary({ dir: path.join(dir, 'diary'), dailyLimit: 2 });
assert.ok(j.append({ text: 'a' }).ok);
assert.ok(j.append({ text: 'b' }).ok);
assert.ok(j.append({ text: 'c' }).error, '超过每日上限被拒');
assert.equal(j.read().used, 2);

fs.rmSync(dir, { recursive: true, force: true });
console.log('情感+日记 通过');
