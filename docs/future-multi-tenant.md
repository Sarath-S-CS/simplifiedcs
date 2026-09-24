# Future: accounts, teams and evidence upload - requirements, not plans

SimplifiedCS deliberately has no accounts: answers, reports and tracking live in the visitor's
browser. If shared workspaces, cross-device history or evidence upload are ever added, these are
the requirements that change, recorded now so the current design doesn't close them off.

## Identity and tenancy

- Every stored row carries a tenant (organization) ID; Postgres row-level security enforces
  tenant isolation for every table, tested with cross-tenant read/write attempts (extend
  `test/supabase-policies.test.js`).
- Roles within a tenant at minimum: owner, editor (answers and tracking), viewer (reports).
- The publishable key must still grant nothing beyond public feed reads.

## Data handling

- Assessment answers describe an organization's weaknesses: treat them as confidential. Encrypt
  at rest (platform default) and consider per-tenant keys for evidence files.
- Retention and deletion: a tenant can export and permanently delete everything; deletion is
  verified, not just flagged.
- Report snapshots stay immutable and versioned (methodology + question set), as they are today.
- AI processing keeps the per-request, versioned consent; a tenant-level setting may disable AI
  entirely.

## Evidence upload

- Evidence attaches to action IDs (`A-<control>`), which are already stable across reports.
- Uploads: size and type allow-list, malware scanning before anyone can download, storage in a
  private bucket with short-lived signed URLs, never served from the site's origin.
- Evidence never goes to the AI endpoint.

## Operations

- Audit log of who changed answers, tracking and risk acceptances.
- Rate limits and budgets become per tenant as well as per client.
- Privacy page, data-processing terms and a sub-processor list must be updated before launch.
