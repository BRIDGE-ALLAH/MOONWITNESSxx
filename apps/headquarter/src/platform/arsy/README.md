# Headquarter ↔ ARSY integration boundary

Headquarter consumes ARSY only through its public, versioned HTTP API. It must not import ARSY runtime modules, Fastify plugins, database/ORM packages, or private server types.

## Configuration

Set `NEXT_PUBLIC_ARSY_API_BASE_URL` to the public API base URL, for example:

```dotenv
NEXT_PUBLIC_ARSY_API_BASE_URL=https://api.example.invalid/api/v1
```

If omitted, the client targets `/api/v1` on the current origin. Use that default only when the deployment reverse proxy routes the prefix to ARSY.

## Usage

```ts
import { arsyRequest } from '@/platform/arsy/client'

type WorkspaceSummary = { id: string; name: string }
const result = await arsyRequest<WorkspaceSummary[]>('workspaces')
```

Pass `signal` for cancellation. The client adds an `x-request-id`, uses same-site credentials, disables implicit caching, and retries transient failures only for GET requests. Mutations are never retried automatically.

## Security and contract status

- The browser client does not accept or persist bearer tokens. Session issuance and renewal must follow the approved ARSY identity/session contract.
- ARSY remains the authorization enforcement point. Hiding a button or route in Headquarter is not access control.
- The adapter understands a conservative error envelope (`error.code`, `error.message`, `error.requestId`, `error.details`) and safe fallback behavior for gateway errors.
- No login, permission, workspace-switch, or health endpoint is assumed to exist. Integrate those flows only after the matching ARSY public contract is implemented and documented.
- Never expose raw `details` in user-facing UI; it is diagnostic data for controlled handling only.
