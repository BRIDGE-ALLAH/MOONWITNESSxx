# Architecture & Design: Apps ID Foundation

## Overview

`apps/id` acts as Experience 04 (Authority for human and service identities, session verification, and access visibility).

## Architecture Context

```mermaid
graph TD
    User([Operator / Subscriber]) --> ID[apps/id :3003]
    ID --> |Issues JWT / HMAC Session Tokens| SessionStorage[Signed HTTP-only Cookies / Tokens]
    Headquarter[apps/headquarter :3000] --> |Verify Identity| ID
    Cockpit[apps/cockpit :3002] --> |Verify Role Privileges| ID
    Gate[apps/gate :3001] --> |Portal Redirection| ID
```

## Contracts & Ports

- Gate: `3001`
- Headquarter: `3000`
- Cockpit: `3002`
- ID: `3003`
- ARSY: `4000`
