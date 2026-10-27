/**
 * IRS TIN structural validation (format-level only; IRS TIN Matching is a later phase).
 */

/** SSN: AAA-GG-SSSS. Area 000, 666, 900-999 invalid; group 00 and serial 0000 invalid. */
export function isStructurallyValidSsn(nineDigits: string): boolean {
  if (!/^\d{9}$/.test(nineDigits)) return false;
  const area = nineDigits.slice(0, 3);
  const group = nineDigits.slice(3, 5);
  const serial = nineDigits.slice(5);
  if (area === '000' || area === '666' || area.startsWith('9')) return false;
  if (group === '00' || serial === '0000') return false;
  return true;
}

/**
 * EIN: first two digits must be an IRS-assigned campus/internet prefix.
 * Source: IRS "How EINs are Assigned and Valid EIN Prefixes".
 */
const VALID_EIN_PREFIXES = new Set<string>([
  '01', '02', '03', '04', '05', '06', '10', '11', '12', '13', '14', '15', '16',
  '20', '21', '22', '23', '24', '25', '26', '27', '30', '31', '32', '33', '34',
  '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47',
  '48', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61',
  '62', '63', '64', '65', '66', '67', '68', '71', '72', '73', '74', '75', '76',
  '77', '80', '81', '82', '83', '84', '85', '86', '87', '88', '90', '91', '92',
  '93', '94', '95', '98', '99',
]);

export function isStructurallyValidEin(nineDigits: string): boolean {
  if (!/^\d{9}$/.test(nineDigits)) return false;
  return VALID_EIN_PREFIXES.has(nineDigits.slice(0, 2));
}
