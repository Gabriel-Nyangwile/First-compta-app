# Payroll Configuration Validation Cheat Sheet

Concise reference for server-side validation of payroll configuration entities (Contribution Schemes, Tax Rules, Cost Centers).

## Common Response Shapes

Validation failure:
```json
{ "ok": false, "error": "validation", "details": ["employeeRate.range", "brackets.2.order"] }
```
Uniqueness conflict on `code`:
```json
{ "ok": false, "error": "code.exists" }
```
Referenced cost center deletion (409):
```json
{ "ok": false, "error": "Cost center referenced; deactivate instead." }
```

## Code Format
Regex: `^[A-Z0-9][A-Z0-9_-]{0,31}$` (max length 32). Always uppercased server-side.

## Contribution Scheme
Fields: `code`, `label`, `employeeRate`, `employerRate`, `ceiling?`, `baseKind`, `active?`.

Error codes:
- code.required / code.format / code.exists
- label.required / label.length ( >120 )
- employeeRate.nan / employeeRate.range (0..1)
- employerRate.nan / employerRate.range (0..1)
- ceiling.invalid (present & <=0 or NaN)
- baseKind.invalid (must be one of BASE_SALAIRE, BRUT, IMPOSABLE)

Notes:
- Rates are fractional decimals (7% => 0.07).
- Ceiling optional; when present must be > 0; contribution base = min(base, ceiling).

## Tax Rule
Fields: `code`, `label`, `brackets[]`, `roundingMode`, `active?`.
Rounding modes: NONE, BANKERS, UP, DOWN.

Bracket element: `{ upTo: number, rate: number }` (ascending `upTo`).

Error codes:
- code.required / code.format / code.exists
- label.required / label.length (>160)
- roundingMode.invalid
- brackets.json (string parse failure)
- brackets.array (not an array)
- brackets.{i}.object (entry not object)
- brackets.{i}.upTo (missing / <=0 / NaN)
- brackets.{i}.rate (missing / NaN / outside 0..1)
- brackets.{i}.order (not strictly ascending vs previous)
- brackets.first.upToPositive (first upTo <= 0)

Notes:
- Ascending order enforced; large sentinel (e.g. 999999999) acceptable for final bracket.
- Future enhancement: continuity from 0 (currently only positivity of first enforced).
- Rounding applies to final aggregated tax, not per bracket subtotal.

## Cost Center
Fields: `code`, `label`, `active?`.

Error codes:
- code.required / code.format / code.exists
- label.required / label.length (>120)

Deletion Safety:
- 409 if referenced by transactions or allocations; prefer deactivation (set `active=false`).

## Usage Patterns
- Always send JSON numbers (not strings) for numeric fields.
- Partial updates (`PUT`) allowed; validation runs on merged existing + incoming data.
- Client UI pre-validates brackets but server is source of truth.

## Examples
Invalid scheme:
```json
{ "ok": false, "error": "validation", "details": ["employeeRate.range", "ceiling.invalid"] }
```
Invalid tax rule:
```json
{ "ok": false, "error": "validation", "details": ["brackets.2.order"] }
```
Duplicate code:
```json
{ "ok": false, "error": "code.exists" }
```

## Quick Checklist (Add/Edit)
1. Code uppercase, matches regex.
2. Label length within limits.
3. Rates 0..1 inclusive.
4. Ceiling (if any) > 0.
5. Brackets strictly ascending; all rates valid.
6. Rounding mode in allowed set.
7. No duplicate code (409 if exists).

Refer to README section 18.8 (EN) / 15.1.8 (FR) for full context.
