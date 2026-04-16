export const PAYROLL_SETTLEMENT_CONFIGS = {
  NET_PAY: {
    code: 'NET_PAY',
    sequenceName: 'PAYROLL_SETTLEMENT',
    prefix: 'PAYSET-',
    label: 'net paie',
    mappingCode: 'NET_PAY',
    debitKind: 'WAGES_PAYABLE',
    allowEmployee: true,
  },
  CNSS: {
    code: 'CNSS',
    sequenceName: 'PAYROLL_SETTLEMENT_CNSS',
    prefix: 'PAYCNSS-',
    label: 'CNSS',
    mappingCode: 'CNSS',
    debitKind: 'EMPLOYEE_SOCIAL_WITHHOLDING',
    allowEmployee: false,
  },
  ONEM: {
    code: 'ONEM',
    sequenceName: 'PAYROLL_SETTLEMENT_ONEM',
    prefix: 'PAYONEM-',
    label: 'ONEM',
    mappingCode: 'ONEM',
    debitKind: 'OTHER_PAYROLL_LIABILITY',
    allowEmployee: false,
  },
  INPP: {
    code: 'INPP',
    sequenceName: 'PAYROLL_SETTLEMENT_INPP',
    prefix: 'PAYINPP-',
    label: 'INPP',
    mappingCode: 'INPP',
    debitKind: 'OTHER_PAYROLL_LIABILITY',
    allowEmployee: false,
  },
  PAYE_TAX: {
    code: 'PAYE_TAX',
    sequenceName: 'PAYROLL_SETTLEMENT_PAYE_TAX',
    prefix: 'PAYIPR-',
    label: 'IPR',
    mappingCode: 'PAYE_TAX',
    debitKind: 'INCOME_TAX_WITHHOLDING',
    allowEmployee: false,
  },
};

export const PAYROLL_SETTLEMENT_PREFIXES = Object.values(PAYROLL_SETTLEMENT_CONFIGS).map((config) => config.prefix);

export function getPayrollSettlementConfig(liabilityCode = 'NET_PAY') {
  const config = PAYROLL_SETTLEMENT_CONFIGS[liabilityCode] || null;
  if (!config) throw new Error(`Unsupported payroll liability code ${liabilityCode}`);
  return config;
}

export function extractPayrollSettlementRef(description) {
  if (!description) return null;
  for (const prefix of PAYROLL_SETTLEMENT_PREFIXES) {
    const match = description.match(new RegExp(`${prefix}[0-9]+`, 'i'));
    if (match) return match[0];
  }
  return null;
}

export function isPayrollSettlementDescription(description) {
  return !!extractPayrollSettlementRef(description);
}