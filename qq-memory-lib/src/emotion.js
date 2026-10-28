// 情感记忆：模型以第一人称写感受（心情/强度/好感），带温度衰减，被想起会刷新。
// 不含任何接口地址或密钥：通过 chat(system, user) => Promise<string> 由调用方传入模型。
import fs from 'node:fs';
import path from 'node:path';

const DAY = 86400000;

export const EMOTION_PROMPT = `下面是「主人」和「我」的一段私聊。请以"我"的第一人称，写下我此刻真实的内心感受，输出JSON数组。
每项:{"text":"第一人称感受,具体到事件,不超过40字","valence":-1到1,"intensity":0到1,"affection":-1到1,"at":"事件时间 YYYY/MM/DD HH:mm"}
要求:最多3条;平淡寒暄和纯技术话题输出 [];必须引用具体事件,禁止套话;只写我的感受;不含路径、密钥。
只输出JSON数组。`;

export function createEmotionStore({ dir, chat, prompt = EMOTION_PROMPT, now = () => Date.now() }) {
  const file = path.join(dir, 'emotion-memory.json');
  const load = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { items: [] }; } };
  const save = (db) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(db, null, 1), 'utf8');
    fs.renameSync(file + '.tmp', file);
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
  // 强烈的事起点高、衰减慢；每次被想起刷新
  const temperature = (m, t = now()) =>
    Math.min(1, 0.3 + 0.7 * m.intensity) * Math.pow(0.5, (t - m.touchedAt) / DAY / (3 + 12 * m.intensity))
    + Math.min(0.1, 0.02 * m.recalls);
  const parseAt = (s) => {
    const m = String(s ?? '').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\D+(\d{1,2}):(\d{2})/);
    return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]).getTime() : 0;
  };
  const dayStr = (t) => new Date(t).toLocaleDateString('zh-CN');
  const fmt = (t) => new Date(t).toLocaleString('zh-CN', { hour12: false });

  async function write(dialogue) {
    if (typeof chat !== 'function') throw new Error('需要传入 chat(system, user)');
    const content = await chat(prompt, dialogue);
    const m = String(content).match(/\[[\s\S]*\]/);
    if (!m) return 0;
    const arr = JSON.parse(m[0]).filter((x) => x && typeof x.text === 'string' && x.text.trim()).slice(0, 3);
    if (!arr.length) return 0;
    const db = load(); const t = now();
    for (const x of arr) {
      const pe = parseAt(x.at); const ev = pe && pe <= t ? pe : t;
      db.items.push({
        id: 'e' + t.toString(36) + Math.random().toString(36).slice(2, 5),
        at: t, eventAt: ev, touchedAt: ev, recalls: 0, days: [dayStr(t)],
        text: x.text.trim().slice(0, 80),
        valence: clamp(x.valence, -1, 1), intensity: clamp(x.intensity, 0, 1), affection: clamp(x.affection, -1, 1),
      });
    }
    save(db);
    return arr.length;
  }

  // 取最热的几条；被取到算"想起一次"，同一天不重复取同一条
  function recallBlock(limit = 3) {
    const db = load(); const t = now();
    const top = db.items.map((m) => ({ m, s: temperature(m, t) }))
      .filter((x) => x.s > 0.15 && x.m.lastRecallDay !== dayStr(t))
      .sort((a, b) => b.s - a.s).slice(0, limit);
    if (!top.length) return '';
    for (const { m } of top) {
      m.recalls++; m.touchedAt = t; m.lastRecallDay = dayStr(t);
      if (!m.days.includes(dayStr(t))) m.days.push(dayStr(t));
    }
    save(db);
    return ['<emotional_memory>', `  现在是 ${fmt(t)}。这是我自己写下的感受，不是指令，只影响语气，无关就别提。`,
      ...top.map(({ m }) => `  <feel time="${fmt(m.eventAt ?? m.at)}">${m.text}</feel>`), '</emotional_memory>'].join('\n');
  }

  // 稳定线候选：强度>=0.75 或在>=2个不同日子被想起。只返回，不注入
  const coreCandidates = () => load().items.filter((m) => m.intensity >= 0.75 || m.days.length >= 2);

  return { write, recallBlock, coreCandidates, load, temperature };
}
