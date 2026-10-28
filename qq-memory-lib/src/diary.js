// 日记：每天一个 jsonl，条数和长度上限写死在创建时，调用方只能给 text / mood。
import fs from 'node:fs';
import path from 'node:path';

export function createDiary({ dir, dailyLimit = 5, textMax = 400, moodMax = 20 }) {
  const dayKey = (d = new Date()) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const fileOf = (day) => path.join(dir, `${day}.jsonl`);
  function read(day = dayKey()) {
    let raw; try { raw = fs.readFileSync(fileOf(day), 'utf8'); } catch { return { entries: [], used: 0, left: dailyLimit }; }
    const entries = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try { entries.push(JSON.parse(line)); } catch { /* 坏行跳过 */ }
    }
    return { entries, used: entries.length, left: Math.max(0, dailyLimit - entries.length) };
  }
  function append({ text, mood }) {
    text = String(text ?? '').trim(); mood = String(mood ?? '').trim();
    if (!text) return { ok: false, error: 'text 不能为空' };
    if (text.length > textMax) return { ok: false, error: `text 太长（最多 ${textMax} 字）` };
    if (mood.length > moodMax) return { ok: false, error: `mood 太长（最多 ${moodMax} 字）` };
    const day = dayKey();
    const { used } = read(day);
    if (used >= dailyLimit) return { ok: false, error: `今天已写满 ${dailyLimit} 条` };
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(fileOf(day), JSON.stringify({ time: new Date().toISOString(), text, ...(mood ? { mood } : {}) }) + '\n', 'utf8');
    return { ok: true, used: used + 1, left: dailyLimit - used - 1 };
  }
  return { read, append };
}
