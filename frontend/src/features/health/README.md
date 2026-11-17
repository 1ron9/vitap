# health

M1 Phase A screens, typed DTOs, queries and mutations live here. `hooks.ts` uses the
shared API transport and keys state by user, session generation and query. Mutations
invalidate related resources; logout/identity changes discard pending responses and drafts.

Real mode reads only backend health data. `mock.ts` is an explicit offline adapter
with separate storage and the same DTOs. `compatibility.ts` supplies the older Chat UI
with permitted health context. Real Dashboard charts are deferred to Phase B.

Contract, runtime setup and acceptance: [docs/m1-phase-a.md](../../../../docs/m1-phase-a.md).
