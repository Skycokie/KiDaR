# Appwrite collection: `ai_usage`

Used by Studio AI chat rate limits (`POST /api/projects/:id/assistant`).

## Attributes

| Key | Type | Size | Required |
|---|---|---|---|
| userId | string | 64 | yes |
| bucket | string | 16 | yes |
| kind | string | 8 | yes (`hour` or `day`) |
| count | integer | — | yes |

## Settings

- Document security: **off** (server API key only; no client SDK access)
- Document IDs are set by the server: `{userId}_{bucket}` (max 36 chars)

## Create (console)

1. Open database `kidar` in the target Appwrite project (staging first: `6aaa617d0039130379ec`, then production: `6aaa61b4000e4035f26e`).
2. Create collection `ai_usage` with the attributes above.
3. Do not add any client role permissions.
4. Optional env override: `APPWRITE_AI_USAGE_COLLECTION=ai_usage`.

Until this collection exists, the assistant route returns **503** `store_missing` when `STUDIO_AI_CHAT_ENABLED` is on.
