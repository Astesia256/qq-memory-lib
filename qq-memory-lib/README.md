# qq-memory-lib

给聊天机器人用的记忆系统，只管记忆，不含 QQ 收发。一个库，两种模式（私聊 / 群聊）。

## 它有五块

| 模块 | 作用 | 文件 |
|---|---|---|
| 向量记忆 | 把记忆变成向量存起来，按相似度召回；相近的自动合并；core 永久，important 30 天半衰，normal 7 天 | `src/vector-store.js` |
| 对话压缩 | 让模型把一段对话压成几条带等级的记忆，每条必须有对话行号作证据 | `src/summarizer.js` |
| 画像 | 群友三档画像（normal 3 天 / important 7 天 / core 永久），必须带日期和原话 | `src/profiles.js` |
| 好感分 | 分数、扣分冷却、加分须可回查、每次变动留事件、+5 重启通道 | `src/notes.js` |
| 模式 | 私聊：只读自己的会话；群聊：只读本群，可写画像 | `src/modes.js` |

## 和原来相比改了什么

- 中转地址、模型名、密钥、角色名都不再写死，全部由你传入配置。
- 不含任何 QQ 号、昵称、本机路径。
- 与 bridge.js 无关，可单独使用。

## 用法（示意）

```js
import { createVectorStore, summarizeDialogue, createMode } from 'qq-memory-lib';

const mode = createMode('group', { sessionId: '123456' });
// 向量存储和压缩需要你传入自己的 embedding / 聊天模型地址与密钥
```

具体参数以各文件顶部的注释和 `test/basic.test.mjs` 为准。

## 测试

```
node test/basic.test.mjs
```

## 注意

- 向量记忆和压缩需要联网调用你自己的模型接口。
- 数据文件里有聊天内容，不要提交到公开仓库。

## 机器人侧的小巧思

已包含在本库里：

- 自动沉淀（`src/auto-summarize.js`）：每 10 轮（可配）对话，让模型把对话压成几条带等级的记忆，按会话分开存放。私聊只召回自己的记忆，不读群。
- 情绪系统（`src/emotion.js`）：第一人称感受，带心情、强度、好感变化和事件时间；有温度衰减，召回只影响语气，不是指令。
- 日记系统（`src/diary.js`）：一天最多 5 条，只能给正文和心情，路径、日期、上限由库固定。
- 群友画像（`src/profiles.js`）：必须带日期和原话，normal / important / core 三档，到期筛查或升级。
- 好感分（`src/notes.js`）：低分段有重启通道，+5 须写明原因，同一人 7 天一次；低分是"减量回应"，不是完全不理。

仍在桥接项目里、未抽入本库：

- 旁观群聊：私聊里只拿一句话摘要，不返回群消息原文，摘要不写入记忆。

## 外部记忆后端（可选）
灵枢(md_cg)是外部记忆系统，不包含在本库内。用 createExternalBackend({ transport }) 接入，库只转发 read/write。


库名：npm 包 @furongjun1999/dsh-memory（灵枢，Lingshu，DSH 插件），内部 Python 模块为 md_cg（认知图，节点为 md 文档）。需自行安装，transport.call 可转发到它的 cg 工具（op=read / op=write）。

