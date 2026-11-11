# Contract baseline on dev

See [CODEBASE_DEV_MIGRATION.md](../CODEBASE_DEV_MIGRATION.md) for source documents,
decisions and unfinished work. `openapi.json` describes implemented routes only.

Regenerate using `python scripts/export_openapi.py`; CI uses `--check`. Domain
statuses live in `backend/app/shared/enums.py`. M1/M2/M3 endpoints remain planned
until their implementations and ownership/consent tests land through PRs into dev.

The dev v3.1 decisions are review candidates, not a claim that the original Drive
documents were edited or that the team has already approved them.
