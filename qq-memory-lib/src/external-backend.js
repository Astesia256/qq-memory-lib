// 外部记忆后端接口（可选）。
// 灵枢（Lingshu / md_cg，Python 认知图记忆系统）是外部项目，不包含在本库内。
// 本库只定义调用约定：你传入 transport，库把 read / write 转发过去。
// transport 形如：{ call: async (op, params) => result }
// 例：在 DSH 里，transport.call 可以转发到 cg 工具（op=read / op=write）。
export const EXTERNAL_BACKEND_NOTE =
  '外部记忆后端：灵枢(md_cg)。本库不含其代码与数据，需自行安装并提供 transport。';

export function createExternalBackend({ name = 'lingshu', transport } = {}) {
  if (!transport || typeof transport.call !== 'function') {
    throw new Error('需要 transport.call(op, params)，用于连接外部记忆后端（如灵枢）');
  }
  return {
    name,
    note: EXTERNAL_BACKEND_NOTE,
    /** 召回：转发为外部后端的 read */
    recall: (query, opts = {}) => transport.call('read', { query, ...opts }),
    /** 写入：转发为外部后端的 write */
    write: (content, opts = {}) => transport.call('write', { content, ...opts }),
    /** 其他操作（如 verify / forget）按原名转发 */
    call: (op, params = {}) => transport.call(op, params),
  };
}
