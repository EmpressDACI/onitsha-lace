export function formatNaira(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}₦${Math.abs(rounded).toLocaleString('en-NG')}`;
}

export function formatNairaCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}₦${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}₦${Math.round(abs / 1_000)}K`;
  }
  return `${sign}₦${Math.round(abs)}`;
}

export function calculateBaleMetrics(
  bales: number,
  landedCostPer5Yards: number,
  targetWholesalePrice: number
) {
  const totalBundles = bales * 12; // 1 bale = 60 yards = 12 bundles of 5 yards
  const totalYards = bales * 60;
  const totalCapitalNgn = totalBundles * landedCostPer5Yards;
  const maxRevenueNgn = totalBundles * targetWholesalePrice;
  const maxGrossProfitNgn = maxRevenueNgn - totalCapitalNgn;
  const unitSpreadNgn = targetWholesalePrice - landedCostPer5Yards;
  const marginPct =
    targetWholesalePrice > 0 ? (unitSpreadNgn / targetWholesalePrice) * 100 : 0;

  return {
    totalBundles,
    totalYards,
    totalCapitalNgn,
    maxRevenueNgn,
    maxGrossProfitNgn,
    unitSpreadNgn,
    marginPct,
  };
}
