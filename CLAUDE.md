# CodeSprint

Client-side typing trainer for code. Next.js 15 App Router, React 19, Chakra 3, Monaco, Vercel AI SDK. See `AGENTS.md` for full project architecture.

## Pi harness bootstrap

This repo contains the development source for the global multi-agent harness.
After installation, runtime usage should go through `~/.pi-harness`,
`pi-harness`, and the Pi `/harness` command, not a CodeSprint-local Node path.

Read before harness work:

- Harness docs: `.pi-harness/README.md`
- Harness config: `.pi-harness/harness.config.json`
- Harness skill: `.pi-harness/skills/pi-multi-agent-harness/SKILL.md`

Default harness commands:

```sh
node .pi-harness/scripts/install-global.mjs
pi-harness validate
pi-harness plan --prompt "<task>"
pi-harness orchestrate --permission-profile review --run-external --prompt "<task>"
pi-harness audit --run-external --prompt "<task>"
```

Routing constraints:

- Codex leader/synthesis must use Codex CLI OAuth through `codex exec`, default model `gpt-5.5`, high reasoning.
- Planner must use Codex CLI OAuth through `codex exec`, default model `gpt-5.5`, high reasoning.
- Executor must use `opencode run --model opencode-go/kimi-k2.7-code`.
- Claude review must use local headless `claude -p`, never OpenRouter.
- Do not require or forward `OPENAI_API_KEY` for GPT leader lanes.
- External dispatch requires explicit `--run-external`.
- Legacy Pi lanes, if manually configured, receive no tools by default; `--allow-external-tools` is required for read-only Pi tools.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
