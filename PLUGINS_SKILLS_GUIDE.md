# Plugins 和 Skills 开发指南

这个项目包含了多个示例插件和技能，展示了如何为 Daiyosei Bot 扩展功能。

## 概念理解

### Plugin (插件)
插件是功能模块，用于注册一组相关的**工具 (Tools)**。插件可以有生命周期（`setup`, `start`, `stop`），支持有状态操作。

**特点：**
- 有唯一的 `id` 标识符
- 通过 `setup()` 方法注册工具
- 可选的 `start()` 和 `stop()` 生命周期方法
- 可以维持内部状态（如数据库连接）

### Skill (技能)
技能是一组高度相关的**工具集合**，通常代表一个特定能力域。技能是无状态的，通过 `tools()` 方法返回工具列表。

**特点：**
- 有唯一的 `id` 标识符
- 声明所需的权限 (`permissions`)
- 通过 `tools()` 方法返回工具数组
- 无生命周期管理，更加轻量

## 示例概览

### 1. 天气插件 (`weatherPlugin.example.ts`)
**类型：** Plugin  
**功能：**
- `get_current_weather` - 获取当前天气
- `get_weather_forecast` - 获取天气预报
- `get_weather_alerts` - 获取天气警报

**使用场景：** 与外部天气API集成

```typescript
const plugin = createWeatherPlugin();
registry.register(plugin);
```

### 2. 数学计算技能 (`mathSkill.example.ts`)
**类型：** Skill  
**功能：**
- `basic_arithmetic` - 基础四则运算
- `advanced_math` - 高级数学函数（sqrt, log等）
- `statistical_analysis` - 统计分析
- `solve_quadratic` - 求解二次方程

**使用场景：** 数学计算和问题求解

```typescript
const skill = createMathSkill();
skillRegistry.register(skill);
```

### 3. 数据库查询插件 (`databasePlugin.example.ts`)
**类型：** Plugin  
**功能：**
- `db_connect` - 建立数据库连接
- `db_query` - 执行查询
- `db_insert` - 插入记录
- `db_join_query` - Join查询
- `db_disconnect` - 关闭连接

**使用场景：** 数据库操作，展示有状态的插件

```typescript
const plugin = createDatabasePlugin({ connectionString: 'sqlite:...' });
registry.register(plugin);
```

### 4. 文本处理技能 (`textProcessingSkill.example.ts`)
**类型：** Skill  
**功能：**
- `analyze_text` - 文本分析（字数、句数等）
- `text_transform` - 文本转换（大小写、反转等）
- `text_search` - 正则表达式搜索
- `extract_entities` - 实体抽取（邮箱、URL、提及等）
- `text_similarity` - 文本相似度计算

**使用场景：** NLP任务和文本处理

```typescript
const skill = createTextProcessingSkill();
skillRegistry.register(skill);
```

## 集成到项目

### 在 Agent 中集成插件和技能

通常在 `src/app.ts` 或主程序中：

```typescript
import { createWeatherPlugin } from './plugins/weatherPlugin.example.js';
import { createMathSkill } from './skills/mathSkill.example.js';
import { PluginRegistry } from './src/plugins/registry.js';
import { SkillRegistry } from './src/skills/registry.js';

// 初始化注册表
const pluginRegistry = new PluginRegistry({ logger });
const skillRegistry = new SkillRegistry();

// 注册插件
const weatherPlugin = createWeatherPlugin();
pluginRegistry.register(weatherPlugin);

// 注册技能
const mathSkill = createMathSkill();
skillRegistry.register(mathSkill);

// 启动插件
await pluginRegistry.startAll();

// 收集所有工具
const allTools = [
  ...pluginRegistry.toTools(),
  ...skillRegistry.toTools(),
];
```

### 注册到 Agent SDK

```typescript
const response = await client.beta.assistants.basicMessages.create({
  model: 'gpt-4',
  system: 'You are a helpful assistant.',
  tools: allTools,
  messages: [
    {
      role: 'user',
      content: 'Calculate sqrt(16) and show weather for London',
    },
  ],
});
```

## 开发指南

### 创建新 Plugin

```typescript
import { tool } from '@openai/agents';
import { z } from 'zod';
import type { BotPlugin } from '../src/plugins/types.js';

export function createMyPlugin(): BotPlugin {
  return {
    id: 'my-plugin',
    name: 'My Custom Plugin',
    description: 'A custom plugin example',
    version: '1.0.0',

    setup(context) {
      context.registerTools([
        tool({
          name: 'my_tool',
          description: 'Does something useful',
          parameters: z.object({
            input: z.string(),
          }),
          execute: (params) => {
            // 实现工具逻辑
            return { result: params.input.toUpperCase() };
          },
        }),
      ]);
    },

    async start() {
      // 可选：初始化
    },

    async stop() {
      // 可选：清理
    },
  };
}
```

### 创建新 Skill

```typescript
import { tool } from '@openai/agents';
import { z } from 'zod';
import type { AgentSkill } from '../src/skills/types.js';

export function createMySkill(): AgentSkill {
  return {
    id: 'my-skill',
    name: 'My Custom Skill',
    description: 'A custom skill example',
    version: '1.0.0',
    permissions: ['my:permission'],

    tools() {
      return [
        tool({
          name: 'my_tool',
          description: 'Does something useful',
          parameters: z.object({
            input: z.string(),
          }),
          execute: (params) => {
            return { result: params.input.toUpperCase() };
          },
        }),
      ];
    },
  };
}
```

## 最佳实践

1. **清晰的命名**
   - 工具名使用 snake_case（`get_weather`）
   - 插件/技能ID使用 kebab-case（`weather-plugin`）
   - 类函数名使用 camelCase（`createWeatherPlugin`）

2. **参数验证**
   - 使用 Zod 进行严格的参数验证
   - 提供有意义的 `describe()` 文本帮助LLM理解
   - 设置合理的默认值

3. **错误处理**
   - 返回 `{ error: 'message' }` 格式的错误
   - 在执行前验证必要条件（如数据库连接）

4. **文档和描述**
   - 给每个工具提供清晰的中英文描述
   - 说明工具的预期用途和副作用
   - 记录所需权限

5. **权限管理**
   - Skills 应声明所需的权限
   - Plugins 可以根据需要限制工具访问

6. **性能考虑**
   - 大量结果时进行分页（见database插件的join查询）
   - 异步操作使用 Promise（如database连接）
   - 考虑超时和资源限制

## 项目结构

```
plugins/
├── weatherPlugin.example.ts       # 天气插件示例
├── databasePlugin.example.ts      # 数据库插件示例
└── ...

skills/
├── mathSkill.example.ts           # 数学计算技能示例
├── textProcessingSkill.example.ts # 文本处理技能示例
└── ...

src/
├── plugins/
│   ├── types.ts                   # Plugin 类型定义
│   ├── registry.ts                # 插件注册表
│   └── corePlugin.ts              # 核心内置插件
├── skills/
│   ├── types.ts                   # Skill 类型定义
│   ├── registry.ts                # 技能注册表
│   └── builtin/
│       └── healthSkill.ts         # 健康检查技能
```

## 测试示例

```typescript
// 测试math skill
const mathSkill = createMathSkill();
const tools = mathSkill.tools();
const basicArith = tools[0];

const result = await basicArith.function.execute({
  a: 10,
  b: 5,
  operation: 'add',
});
console.log(result); // { operation: 'add', a: 10, b: 5, result: 15 }
```

## 参考资源

- [OpenAI Agents SDK 文档](https://platform.openai.com/docs/guides/agents)
- [Zod 文档](https://zod.dev)
- 项目中的 `src/skills/builtin/healthSkill.ts` 和 `src/plugins/corePlugin.ts`
