// 好感分 + 事件记录。规则写死在库里，调用方只传 id / delta / type / quote / reason。
// 主人 id 和初始名单由调用方配置，库里不含任何个人信息。
import fs from 'node:fs';
import path from 'node:path';

const DAY = 86400000;
export const VIOLATION_TYPES = ['下流话', '威胁骚扰', '纠缠已拒绝', '当工具使', '重复提问', '人身攻击', '造谣假话', '其他'];
export const VERIFIABLE_TYPES = ['戳穿假话', '纠正事实错误', '真诚道歉并有后续', '提供有用信息'];
const dayKey = () => new Date().toISOString().slice(0, 10);

export function createNotes({ dir, ownerId, initial = {}, rules = {} }) {
  const R = { stepMax: 3, dayMax: 10, negMax: 2, cooldownDays: 14, restartBonus: 5, restartWindowDays: 7, restartWeeklyMax: 2, ...rules };
  const file = path.join(dir, 'notes.json');
  const load = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { people: structuredClone(initial), daily: {}, events: [] }; } };
  const save = (s) => {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(s, null, 1), 'utf8'); fs.renameSync(tmp, file);
  };
  const fresh = (s) => { const d = dayKey(); if (s.daily.day !== d) s.daily = { day: d, used: {} }; };

  return {
    read: () => { const s = load(); fresh(s); return { ok: true, people: s.people, usedToday: s.daily.used }; },
    events: (id, n = 20) => load().events.filter((e) => !id || e.id === String(id)).slice(-n),

    /** 加减分。扣分：同类违规 cooldownDays 内第一次只提醒不扣。加分：type 必须是可回查类型。必须附原话。 */
    set({ id, name, delta, type, quote, reason = '' }) {
      id = String(id ?? '').trim();
      if (!id) return { ok: false, error: '缺少 id' };
      if (id === String(ownerId)) return { ok: false, error: '主人固定分数，不能改' };
      delta = Number(delta);
      if (!Number.isInteger(delta) || delta === 0) return { ok: false, error: 'delta 必须是非零整数' };
      if (Math.abs(delta) > R.stepMax) return { ok: false, error: `单次最多 ±${R.stepMax}；一次性加 ${R.restartBonus} 请用 restart` };
      if (delta < -R.negMax) return { ok: false, error: `单次最多扣 ${R.negMax} 分` };
      quote = String(quote ?? '').trim();
      if (!quote) return { ok: false, error: '必须附原话片段 quote' };
      const neg = delta < 0;
      if (!(neg ? VIOLATION_TYPES : VERIFIABLE_TYPES).includes(type)) return { ok: false, error: `type 必须是：${(neg ? VIOLATION_TYPES : VERIFIABLE_TYPES).join('/')}` };
      const s = load(); fresh(s);
      const p = s.people[id] || (s.people[id] = { name: name || id, score: 30 });
      const used = s.daily.used[id] || 0;
      let applied = delta, warned = false;
      if (neg) {
        const cut = Date.now() - R.cooldownDays * DAY;
        if (!s.events.some((e) => e.id === id && e.type === type && e.kind === 'violation' && Date.parse(e.at) > cut)) { applied = 0; warned = true; }
      } else if (delta === R.stepMax) {
        const cut = Date.now() - R.cooldownDays * DAY;
        if (!s.events.some((e) => e.id === id && e.kind === 'credit' && Date.parse(e.at) > cut)) delta = applied = R.stepMax - 1; // 加得慢
      }
      if (used + Math.abs(applied) > R.dayMax) return { ok: false, error: `今天已用 ${used}/${R.dayMax}` };
      const before = p.score;
      p.score = Math.max(0, Math.min(100, before + applied));
      s.daily.used[id] = used + Math.abs(applied);
      s.events.push({ at: new Date().toISOString(), id, kind: neg ? 'violation' : 'credit', type, delta, applied, warned, before, after: p.score, quote: quote.slice(0, 60), reason: String(reason).slice(0, 120) });
      if (s.events.length > 3000) s.events = s.events.slice(-3000);
      save(s);
      return { ok: true, before, after: p.score, warnedOnly: warned };
    },

    /** 一次性 +restartBonus，当天额度记满。reason ≥20 字；同人 7 天一次，全体一周最多 2 次。是否给由调用方（模型）判断。 */
    restart({ id, reason }) {
      id = String(id ?? '').trim();
      if (id === String(ownerId)) return { ok: false, error: '主人固定分数，不能改' };
      reason = String(reason ?? '').trim();
      if (reason.length < 20) return { ok: false, error: 'reason 至少20字：写清做了什么、为什么判断不是恶意或表演' };
      const s = load(); fresh(s);
      const p = s.people[id]; if (!p) return { ok: false, error: '没有这个人' };
      const since = Date.now() - R.restartWindowDays * DAY;
      const recent = s.events.filter((e) => e.kind === 'restart' && Date.parse(e.at) > since);
      if (recent.some((e) => e.id === id)) return { ok: false, error: '同一个人7天内只给一次' };
      if (recent.length >= R.restartWeeklyMax) return { ok: false, error: `全部人一周最多${R.restartWeeklyMax}次` };
      const before = p.score;
      p.score = Math.min(100, before + R.restartBonus);
      s.daily.used[id] = R.dayMax;
      s.events.push({ at: new Date().toISOString(), id, kind: 'restart', type: 'restart', delta: R.restartBonus, applied: p.score - before, before, after: p.score, quote: '', reason: reason.slice(0, 300) });
      save(s);
      return { ok: true, before, after: p.score };
    },
  };
}
