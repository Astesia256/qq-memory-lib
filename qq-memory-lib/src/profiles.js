// 三档画像：normal 3天、important 7天、core 永久。每条必须带日期、原话、具体事。
// important 到期时若 identifiable 则升 core。core 需同时 identifiable && changes_relation。
import fs from 'node:fs';
import path from 'node:path';

export const KINDS = ['good', 'bad'];
export const TIERS = ['normal', 'important', 'core'];
const DAY = 86400000;
const today = () => new Date().toISOString().slice(0, 10);

export function createProfiles({ dir, ttlDays = { normal: 3, important: 7 }, maxPerPerson = 12 }) {
  const file = path.join(dir, 'profiles.json');
  const save = (s) => {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(s, null, 1), 'utf8');
    fs.renameSync(tmp, file);
  };
  const load = () => {
    let s; try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { people: {} }; }
    const now = Date.now(); let dirty = false;
    for (const p of Object.values(s.people || {})) {
      p.entries = (p.entries || []).filter((e) => {
        const tier = e.tier || 'core'; if (tier === 'core') return true;
        if (now - Date.parse(e.at) < ttlDays[tier] * DAY) return true;
        dirty = true;
        if (tier === 'important' && e.identifiable) { e.tier = 'core'; return true; }
        return false;
      });
    }
    if (dirty) save(s);
    return s;
  };
  return {
    read(id) { const s = load(); return id ? (s.people[String(id)] || { name: '', entries: [] }) : s.people; },
    brief(id, n = 4) {
      const p = load().people[String(id)];
      return p?.entries?.length ? p.entries.slice(-n).map((e) => `${e.date}[${e.kind}]${e.fact}(原话:${e.quote})`).join('；') : '';
    },
    add({ id, name, date, kind, quote, fact, tier = 'normal', identifiable = false, changes_relation = false }) {
      if (!TIERS.includes(tier)) return { ok: false, error: 'tier 必须是 normal/important/core' };
      if (tier === 'core' && !(identifiable && changes_relation)) return { ok: false, error: 'core 需同时 identifiable 与 changes_relation' };
      if (!KINDS.includes(kind)) return { ok: false, error: 'kind 必须是 good/bad' };
      id = String(id ?? '').trim(); quote = String(quote ?? '').trim(); fact = String(fact ?? '').trim();
      date = String(date ?? '').trim() || today();
      if (!id) return { ok: false, error: '缺少 id' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'date 格式 YYYY-MM-DD' };
      if (!quote) return { ok: false, error: '必须附原话 quote' };
      if (!fact) return { ok: false, error: '必须写具体事 fact' };
      const s = load();
      const p = s.people[id] || (s.people[id] = { name: '', entries: [] });
      if (name) p.name = String(name).slice(0, 20);
      p.entries.push({ tier, identifiable: !!identifiable, date, kind, quote: quote.slice(0, 80), fact: fact.slice(0, 120), at: new Date().toISOString() });
      if (p.entries.length > maxPerPerson) p.entries = p.entries.slice(-maxPerPerson);
      save(s);
      return { ok: true, id, count: p.entries.length };
    },
  };
}
