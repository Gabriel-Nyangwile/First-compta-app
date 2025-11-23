// Shared server-side validation for payroll configuration entities.
// Keep logic minimal & deterministic; return { ok, errors, data }.

const CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]{0,31}$/; // up to 32 chars
const BASE_KINDS = new Set(['BASE_SALAIRE','BRUT','IMPOSABLE']);
const ROUNDING_MODES = new Set(['NONE','BANKERS','UP','DOWN']);

function sanitizeString(v) {
  if (v == null) return '';
  return String(v).trim();
}

export function validateContributionScheme(input) {
  const errors = [];
  const code = sanitizeString(input.code).toUpperCase();
  const label = sanitizeString(input.label);
  const employeeRate = Number(input.employeeRate);
  const employerRate = Number(input.employerRate);
  const ceiling = input.ceiling == null || input.ceiling === '' ? null : Number(input.ceiling);
  const baseKind = sanitizeString(input.baseKind).toUpperCase();
  const active = !!input.active;

  if (!code) errors.push('code.required'); else if (!CODE_REGEX.test(code)) errors.push('code.format');
  if (!label) errors.push('label.required'); else if (label.length > 120) errors.push('label.length');
  if (Number.isNaN(employeeRate)) errors.push('employeeRate.nan'); else if (employeeRate < 0 || employeeRate > 1) errors.push('employeeRate.range');
  if (Number.isNaN(employerRate)) errors.push('employerRate.nan'); else if (employerRate < 0 || employerRate > 1) errors.push('employerRate.range');
  if (ceiling != null && (Number.isNaN(ceiling) || ceiling <= 0)) errors.push('ceiling.invalid');
  if (!BASE_KINDS.has(baseKind)) errors.push('baseKind.invalid');

  return { ok: errors.length === 0, errors, data: { code, label, employeeRate, employerRate, ceiling, baseKind, active } };
}

export function validateTaxRule(input) {
  const errors = [];
  const code = sanitizeString(input.code).toUpperCase();
  const label = sanitizeString(input.label);
  const roundingMode = sanitizeString(input.roundingMode || 'BANKERS').toUpperCase();
  const active = !!input.active;
  let bracketsRaw = input.brackets;

  if (!code) errors.push('code.required'); else if (!CODE_REGEX.test(code)) errors.push('code.format');
  if (!label) errors.push('label.required'); else if (label.length > 160) errors.push('label.length');
  if (!ROUNDING_MODES.has(roundingMode)) errors.push('roundingMode.invalid');

  // Parse brackets
  let brackets;
  if (typeof bracketsRaw === 'string') {
    try { brackets = JSON.parse(bracketsRaw); } catch { errors.push('brackets.json'); brackets = []; }
  } else brackets = bracketsRaw;
  if (!Array.isArray(brackets)) { errors.push('brackets.array'); brackets = []; }

  // Structural validation
  let lastUpTo = -1;
  brackets.forEach((b,i) => {
    if (typeof b !== 'object' || b == null) { errors.push(`brackets.${i}.object`); return; }
    const upTo = b.upTo;
    const rate = b.rate;
    if (typeof upTo !== 'number' || Number.isNaN(upTo) || upTo <= 0) errors.push(`brackets.${i}.upTo`);
    if (typeof rate !== 'number' || Number.isNaN(rate) || rate < 0 || rate > 1) errors.push(`brackets.${i}.rate`);
    if (upTo != null && upTo <= lastUpTo) errors.push(`brackets.${i}.order`);
    lastUpTo = upTo;
  });
  // Continuity: optional check first bracket start implicitly from 0
  if (brackets.length && brackets[0].upTo <= 0) errors.push('brackets.first.upToPositive');

  return { ok: errors.length === 0, errors, data: { code, label, brackets, roundingMode, active } };
}

export function validateCostCenter(input) {
  const errors = [];
  const code = sanitizeString(input.code).toUpperCase();
  const label = sanitizeString(input.label);
  const active = !!input.active;
  if (!code) errors.push('code.required'); else if (!CODE_REGEX.test(code)) errors.push('code.format');
  if (!label) errors.push('label.required'); else if (label.length > 120) errors.push('label.length');
  return { ok: errors.length === 0, errors, data: { code, label, active } };
}

export function formatValidationError(errors) {
  return { ok: false, error: 'validation', details: errors };
}
