export const PLATFORM_COMMISSION_PERCENT = 5;

export function calculateTransactionAmounts(grossCents: number) {
  const gross = Math.max(0, Math.round(grossCents));
  const commissionCents = gross === 0
    ? 0
    : Math.round((gross * PLATFORM_COMMISSION_PERCENT) / 100);

  return {
    grossCents: gross,
    commissionCents,
    netCents: gross - commissionCents,
  };
}