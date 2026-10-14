---
name: api-endpoint-workflow
description: Use when adding or changing API endpoints.
---

## When To Use

- New endpoint
- Request/response schema change
- Auth/validation change

## Steps

1. Read the API contract docs.
2. Check existing endpoint patterns.
3. Update schema first.
4. Implement handler.
5. Add or update tests.
6. Update docs and examples.

## Verification

- Run endpoint tests
- Run typecheck
- Confirm docs changed if contract changed

## Common Mistakes

- Forgetting schema updates
- Changing response shape without docs
- Skipping auth/error-path tests
