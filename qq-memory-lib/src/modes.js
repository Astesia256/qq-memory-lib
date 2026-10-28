// 两种模式的隔离规则。scope 约定：'private:<id>' 或 'group:<id>'。
// private：能读自己的私聊 + 你列出的 sharedGroups（默认空 = 只读自己）。
// group：只读本群。写入时群聊必须有发言人 id，否则不入库（防张冠李戴）。
export function createMode(mode, { sessionId, sharedGroups = [] }) {
  if (mode !== 'private' && mode !== 'group') throw new Error("mode 必须是 'private' 或 'group'");
  const scope = `${mode}:${sessionId}`;
  // 私聊、群聊都只读自己的会话（不再跨读群）。sharedGroups 参数保留但被忽略。
  const readable = new Set([scope]);
  return {
    mode, scope,
    canRead: (s) => readable.has(s),
    /** 返回可写入的发言人 id；群聊缺失则返回 null（调用方应跳过入库） */
    speakerFor(speaker) {
      if (speaker && speaker !== 'unknown') return String(speaker);
      return mode === 'private' ? String(sessionId) : null;
    },
    canWriteProfiles: mode === 'group',   // 群聊可写画像；私聊只读
  };
}
