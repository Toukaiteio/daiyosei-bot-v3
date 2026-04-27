# Daiyosei Bot V3

Node.js rewrite of Daiyosei Bot with OneBot, OpenAI Agents SDK, plugins, and Agent Skills.

Current source of truth:

- [requirement.md](./requirement.md)

Legacy reference kept for migration work:

- [reference/legacy-onebot-v11/README.md](./reference/legacy-onebot-v11/README.md)

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

Copy `.env.example` to `.env` and fill the model settings before running agent calls.

## Current Foundation

- `src/agent`: OpenAI Agents SDK runtime and model routing.
- `src/plugins`: plugin registration and core plugin tools.
- `src/skills`: Agent Skill registration and built-in health skill.
- `src/adapters/onebot`: OneBot message mapping boundary.
- `src/sandbox`: conservative sandbox policy layer.
- `src/server`: Fastify API surface for health, skills, plugins, and agent runs.
