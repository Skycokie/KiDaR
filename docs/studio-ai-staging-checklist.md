# Studio AI chat — staging checklist

## Done in repo / Appwrite

- [x] Code behind `STUDIO_AI_CHAT_ENABLED` (default off)
- [x] Code behind `FIGURE_TEXT_3D_ENABLED` (default off)
- [x] Collection `ai_usage` created on Appwrite **staging** (`6aaa617d0039130379ec`) and **production** (`6aaa61b4000e4035f26e`)
- [x] Privacy copy lists OpenAI; consent kind `ai` added
- [x] Unit tests (web 323, core 181, worker 46)

## Needs your keys / flags (do not commit secrets)

1. Vercel **kidar-studio-staging**: set `OPENAI_API_KEY`, optionally `AI_CHAT_MODEL=gpt-4o-mini`
2. Set `STUDIO_AI_CHAT_ENABLED=true` on staging only
3. Open Studio → Personaj → idea chat; accept AI consent once
4. Try RO + EN prompts (e.g. “peștele înoată printre stele”, “the fish is swimming”)
5. Confirm settings update; confirm `suggest_3d` switches to Figurine mode (does not start paid job alone)
6. Confirm rate limit after ~10/hour returns a friendly error
7. Set a monthly budget cap in the OpenAI dashboard before enabling production
8. Production: leave flags **off** until you review legal + costs, then enable explicitly

## Text-to-3D (v2)

- Requires worker with Tripo + `FIGURE_TEXT_3D_ENABLED=true` (not on Vercel Tripo keys)
- Staging has no worker today — cannot E2E text-to-3D there until a staging worker exists
