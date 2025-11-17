// Centralized feature flags.
// Read environment variables once; expose predicate helpers.
// Extend cautiously; keep names explicit.

export function isClaudeSonnetEnabled() {
  return process.env.ENABLE_CLAUDE_SONNET_4_5 === '1' || process.env.ENABLE_CLAUDE_SONNET_4_5 === 'true';
}

export function isPayrollModuleEnabled() {
  // Payroll schema already present; allow UI gating if needed.
  return process.env.ENABLE_PAYROLL !== '0';
}

export const featureFlags = {
  claudeSonnet: isClaudeSonnetEnabled(),
  payroll: isPayrollModuleEnabled(),
};
