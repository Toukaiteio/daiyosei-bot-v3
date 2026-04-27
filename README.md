# Daiyosei Bot V3

Node.js rewrite of Daiyosei Bot with OneBot, OpenAI Agents SDK, plugins, and Agent Skills.

Current source of truth:

- [requirement.md](./requirement.md)


## Development

```bash
npm install
npm run build
npm test
npm run dev
```

Copy `.env.example` to `.env`, then configure models in `data/config.json` or through the WebUI before running agent calls.

## Current Foundation

- `src/agent`: OpenAI Agents SDK runtime and model routing.
- `src/plugins`: plugin registration and core plugin tools.
- `src/skills`: Agent Skill registration and built-in health skill.
- `src/adapters/onebot`: OneBot message mapping boundary.
- `src/sandbox`: conservative sandbox policy layer.
- `src/server`: Fastify API surface for health, skills, plugins, and agent runs.
