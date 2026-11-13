# DSCR Investor Toolkit

Before any work: read docs/SPEC.md (product). Before ANY UI, PDF or email change: read docs/DESIGN.md (mandatory).
Visual reference: docs/design-reference/ (open the HTML for the theme × surface you're building).

## Non-negotiables
- All money math lives in lib/dscr only. The design layer formats numbers; it never computes them.
- No hex colors, font names, radii or design px constants outside src/design/. Use semantic tokens.
- Three switchable themes (maison, terminal, atelier) per broker. Only the six components listed in DESIGN.md §6 may branch on theme.
- Every public page, PDF and email carries the broker footer (both NMLS IDs, licensed states, disclaimer, Equal Housing Opportunity).
- Banned words in UI/PDF/email/AI drafts: approved, pre-approved, pre-qualified, qualifies, guaranteed, commitment.
- Tenant data goes through forBroker(brokerId) (lib/db/scoped.ts), never raw prisma.

## Commands (create these scripts if missing)
dev · test · lint · typecheck · test:e2e · seed · design:css · design:gallery

## Workflow
Plan first and wait for "ok". After each module: run tests and Playwright, report in 5 lines.
Log every judgment call in docs/DECISIONS.md. Ask before adding dependencies.
