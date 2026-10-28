// 每 N 轮对话自动沉淀一次记忆。任何失败都静默跳过（交给 onError），不影响主流程。
// 用法：
//   const auto = createAutoSummarizer({ summarize, store, getMessages, formatLine });
//   auto.tick('private:1');  // 每轮对话后调用一次
export function createAutoSummarizer({
  summarize,            // async (numberedDialogue) => [{ text, level, speaker_id }]
  store,                // 需要有 add({ scope, summary, level, ... })
  getMessages,          // (key) => [{ time, text, ... }]
  formatLine = (m) => `[${new Date(m.time ?? Date.now()).toLocaleString('zh-CN', { hour12: false })}] ${m.sender ?? ''}: ${m.text}`,
  every = 10,
  minMessages = 4,
  maxMessages = 30,
  isOwner = () => false,
  onWritten = () => {},
  onError = () => {},
  onDialogue = null,    // 可选：拿到整理好的对话文本，用于情绪等旁路
} = {}) {
  const turns = new Map();
  const lastAt = new Map();
  return {
    tick(key) {
      try {
        const n = (turns.get(key) ?? 0) + 1;
        turns.set(key, n);
        if (n % every !== 0) return false;
        const since = lastAt.get(key) ?? 0;
        const msgs = (getMessages(key) ?? []).filter((m) => (m.time ?? 0) > since && m.text).slice(-maxMessages);
        if (msgs.length < minMessages) return false;
        lastAt.set(key, msgs[msgs.length - 1].time ?? Date.now());
        const dialogue = msgs.map(formatLine).join('\n');
        if (onDialogue) Promise.resolve(onDialogue(key, dialogue)).catch(onError);
        const numbered = dialogue.split('\n').map((l, i) => `#${i + 1} ${l}`).join('\n');
        Promise.resolve(summarize(numbered)).then(async (items) => {
          for (const it of items ?? []) {
            await store.add({ scope: key, summary: it.text, level: it.level, speaker_id: it.speaker_id, from_owner: isOwner(it.speaker_id), source: `auto:${key}` });
          }
          if (items?.length) onWritten(key, items.length);
        }).catch(onError);
        return true;
      } catch (e) { onError(e); return false; }
    },
  };
}
