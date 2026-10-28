// 对话压缩：把一段带行号的对话压成若干条分级记忆。
// chat 由调用方提供（async (systemPrompt, userText) => string），库不带地址/密钥/模型名。
// 对话行格式：#行号 [时间] 昵称(ID): 内容

export function buildPrompt({ ownerName = '主人', botName = '助手' } = {}) {
  return `你是记忆整理员。下面是「${ownerName}」和「${botName}」的一段对话。请提炼出值得长期记住的内容，输出JSON数组，每项 {"text":"一句话记忆","evidence":[依据的行号],"level":"core|important|normal"}。
要求：
- 每行以 #行号 开头；evidence 必须填真实行号，不填或填错的记忆会被丢弃。主语必须是 evidence 行里真正说话的人。
- ${botName}自己的吐槽、玩笑、台词不当事实记，除非是明确承诺或约定。
- 每条一句话，第三人称客观陈述，带具体事实。
- 只留：${ownerName}的偏好与个人信息、双方约定与决定、重要事件、${botName}的承诺或遗留问题、有情感意义的互动。群里其他人的话最多记2条。
- 丢掉：寒暄、重复、技术排障细节、文件路径、token 等敏感信息。
- level 从严，拿不准降一档：core(永久，极少)=身份档案、长期约定、重大情感事件、明确说"记住"；important(30天)=有时限的计划、待办、稳定偏好、较大事件；normal(7天)=闲聊、一次性情绪、流水账。其他人说的话最多 important，不得标 core。
- 最多8条；没有就输出 []。只输出JSON数组。`;
}

/** @param {string} text 带行号对话  @param {{chat:Function, ownerName?:string, botName?:string, botId?:string}} o */
export async function summarizeDialogue(text, o) {
  if (typeof o?.chat !== 'function') throw new Error('summarizeDialogue 需要 chat 函数');
  const content = await o.chat(buildPrompt(o), text);
  const m = String(content).match(/\[[\s\S]*\]/);
  if (!m) return [];
  let arr; try { arr = JSON.parse(m[0]); } catch { return []; }
  const spk = new Map();
  for (const ln of text.split('\n')) {
    const r = ln.match(/^#(\d+) \[[^\]]*\] (.*?): /); if (!r) continue;
    const id = r[2].match(/\(([^)]+)\)$/);
    const isBot = (o.botId && id?.[1] === o.botId) || (o.botName && r[2].startsWith(o.botName));
    spk.set(Number(r[1]), isBot ? 'bot' : (id ? id[1] : 'unknown'));
  }
  const out = [];
  for (const s of Array.isArray(arr) ? arr : []) {
    if (!s || typeof s !== 'object' || !String(s.text ?? '').trim()) continue;
    const ev = (Array.isArray(s.evidence) ? s.evidence : []).map(Number).filter((n) => spk.has(n));
    if (!ev.length) continue;
    const who = new Set(ev.map((n) => spk.get(n)));
    const speaker = who.size === 1 ? [...who][0] : 'unknown';
    if (speaker === 'bot') continue;
    out.push({ text: String(s.text).trim(), speaker, level: ['core', 'important', 'normal'].includes(s.level) ? s.level : 'normal' });
  }
  return out.slice(0, 8);
}
