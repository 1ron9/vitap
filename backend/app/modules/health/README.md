# health

M1 Phase A implements profile, conditions, allergies, declarations/preferences,
health entries/observations and medication courses. Routes delegate to the service;
the repository scopes every personal query to an authenticated active USER.

Journal aggregate updates use one transaction and lock the parent entry. Allergy
declarations and list mutations share the settings row lock. Personal context callers
must use `policy.py` with Principal, mode and requested sections.

Contract and acceptance: [docs/m1-phase-a.md](../../../../../docs/m1-phase-a.md).
Metrics/charts for Phase B and chatbot/rule-engine integration remain outside this module's Phase A scope.
