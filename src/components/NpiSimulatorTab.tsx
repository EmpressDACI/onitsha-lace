import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { NpiSimulationItem } from '../data/onitshaSamples';
import {
  calculateBaleMetrics,
  formatNaira,
  formatNairaCompact,
} from '../utils/formatters';

interface NpiSimulatorTabProps {
  activeSimulation: NpiSimulationItem;
  simulations: NpiSimulationItem[];
  prefillLaceName?: string;
  prefillLaceVariety?: string;
  fxRateNgnPerUsd: number;
  onFxRateChange: (rate: number) => void;
  onSimulationCreated: (item: NpiSimulationItem) => void;
  onSelectSimulation: (item: NpiSimulationItem) => void;
  getToken: () => Promise<string | null>;
}

const LAUNCH_MONTHS = [
  'January (Post-Festive Restock)',
  'February (Early Q1 Bridal)',
  'March–April (Easter & Spring Weddings)',
  'May–July (Mid-Year Igba Nkwu Peak)',
  'August–October (Early Bridal Booking)',
  'November (Pre-Christmas Wholesale Rush)',
  'December (Detty December & Igba Nkwu)',
];

const LACE_VARIETIES = [
  'Swiss Voile',
  'Cord Lace',
  'Guipure',
  'French Beaded/Sequined',
  'Dry Lace',
];

export const NpiSimulatorTab: React.FC<NpiSimulatorTabProps> = ({
  activeSimulation,
  simulations,
  prefillLaceName,
  prefillLaceVariety,
  fxRateNgnPerUsd,
  onFxRateChange,
  onSimulationCreated,
  onSelectSimulation,
  getToken,
}) => {
  const [laceName, setLaceName] = useState(
    prefillLaceName || activeSimulation.laceName
  );
  const [laceVariety, setLaceVariety] = useState(
    prefillLaceVariety || activeSimulation.laceVariety
  );
  const [landedCost, setLandedCost] = useState(
    activeSimulation.landedCostPer5Yards
  );
  const [wholesalePrice, setWholesalePrice] = useState(
    activeSimulation.targetWholesalePrice
  );
  const [orderBales, setOrderBales] = useState(activeSimulation.orderBales);
  const [targetLaunchMonth, setTargetLaunchMonth] = useState(
    activeSimulation.targetLaunchMonth
  );
  const [chartView, setChartView] = useState<'profit' | 'sellthrough'>('profit');
  const [isSimulating, setIsSimulating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (prefillLaceName) setLaceName(prefillLaceName);
  }, [prefillLaceName]);

  useEffect(() => {
    if (prefillLaceVariety && LACE_VARIETIES.includes(prefillLaceVariety)) {
      setLaceVariety(prefillLaceVariety);
    }
  }, [prefillLaceVariety]);

  const metrics = calculateBaleMetrics(orderBales, landedCost, wholesalePrice);
  const impliedUsdLanded =
    fxRateNgnPerUsd > 0 ? (landedCost / fxRateNgnPerUsd).toFixed(2) : '0.00';

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setErrorMsg(null);

    try {
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/ai/simulate-npi', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          laceName: laceName.trim() || 'Onitsha Lace Lot',
          laceVariety,
          landedCostPer5Yards: landedCost,
          targetWholesalePrice: wholesalePrice,
          orderBales,
          fxRateNgnPerUsd,
          targetLaunchMonth,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'NPI simulation failed.');
      }

      const newItem: NpiSimulationItem = {
        id: data.savedId ? `db-${data.savedId}` : `sim-${Date.now()}`,
        laceName: laceName.trim() || 'Onitsha Lace Lot',
        laceVariety,
        landedCostPer5Yards: landedCost,
        targetWholesalePrice: wholesalePrice,
        orderBales,
        fxRateNgnPerUsd,
        targetLaunchMonth,
        verdict: data.verdict,
        verdictRationale: data.verdictRationale,
        scenarios: data.scenarios,
        asoEbiDiscountTier: data.asoEbiDiscountTier,
        riskFactors: data.riskFactors,
        groundingSources: data.groundingSources || [],
        createdAt: new Date().toISOString(),
        isPersisted: Boolean(data.savedId),
      };

      onSimulationCreated(newItem);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to run Gemini NPI financial simulation.');
    } finally {
      setIsSimulating(false);
    }
  };

  // Prepare Recharts data
  const profitChartData = activeSimulation.scenarios.map((s) => ({
    name: s.name,
    netProfitNgn: s.netProfitNgn,
    grossMarginPct: s.grossMarginPct,
  }));

  const sellThroughData = [
    {
      horizon: '30 Days',
      'Best Case': activeSimulation.scenarios[0]?.sellThrough30d ?? 0,
      'Base Case': activeSimulation.scenarios[1]?.sellThrough30d ?? 0,
      'Worst Case': activeSimulation.scenarios[2]?.sellThrough30d ?? 0,
    },
    {
      horizon: '60 Days',
      'Best Case': activeSimulation.scenarios[0]?.sellThrough60d ?? 0,
      'Base Case': activeSimulation.scenarios[1]?.sellThrough60d ?? 0,
      'Worst Case': activeSimulation.scenarios[2]?.sellThrough60d ?? 0,
    },
    {
      horizon: '90 Days',
      'Best Case': activeSimulation.scenarios[0]?.sellThrough90d ?? 0,
      'Base Case': activeSimulation.scenarios[1]?.sellThrough90d ?? 0,
      'Worst Case': activeSimulation.scenarios[2]?.sellThrough90d ?? 0,
    },
  ];

  const verdictConfig =
    activeSimulation.verdict === 'GO — High Margin'
      ? {
          box: 'bg-emerald-50 border-emerald-200 text-emerald-950',
          badge: 'bg-emerald-800 text-white',
          Icon: CheckCircle2,
        }
      : activeSimulation.verdict === 'TEST SMALL BATCH'
      ? {
          box: 'bg-amber-50 border-amber-200 text-amber-950',
          badge: 'bg-amber-600 text-white',
          Icon: AlertTriangle,
        }
      : {
          box: 'bg-rose-50 border-rose-200 text-rose-950',
          badge: 'bg-rose-700 text-white',
          Icon: ShieldAlert,
        };

  const VerdictIcon = verdictConfig.Icon;

  return (
    <div className="space-y-6">
      {/* Recent Simulations History Bar */}
      {simulations.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
            Saved Runs:
          </span>
          {simulations.slice(0, 5).map((sim) => (
            <button
              key={sim.id}
              type="button"
              onClick={() => onSelectSimulation(sim)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                sim.id === activeSimulation.id
                  ? 'border-emerald-800 bg-emerald-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {sim.laceName} · {sim.orderBales} bales
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Financial Modeling Inputs */}
        <form
          onSubmit={handleRunSimulation}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Bale & Landed Cost Economics
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard Onitsha bale conversion: 1 bale = 60 yards (12 × 5-yard bundles)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="npi-lace-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Lace Name
              </label>
              <input
                id="npi-lace-name"
                type="text"
                value={laceName}
                onChange={(e) => setLaceName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label
                htmlFor="npi-lace-variety"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Lace Variety
              </label>
              <select
                id="npi-lace-variety"
                value={laceVariety}
                onChange={(e) => setLaceVariety(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                {LACE_VARIETIES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Landed Cost per 5 Yards */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="npi-landed-cost"
                className="text-xs font-medium text-slate-700"
              >
                Landed Cost per 5 Yards (₦)
              </label>
              <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                {formatNaira(landedCost)} (${impliedUsdLanded})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="npi-landed-cost"
                type="range"
                min={20000}
                max={220000}
                step={1000}
                value={landedCost}
                onChange={(e) => setLandedCost(Number(e.target.value))}
                className="w-full accent-emerald-800"
              />
              <input
                type="number"
                min={5000}
                max={500000}
                step={500}
                value={landedCost}
                onChange={(e) => setLandedCost(Math.max(1000, Number(e.target.value)))}
                className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums"
              />
            </div>
          </div>

          {/* Target Wholesale Price per 5 Yards */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="npi-wholesale-price"
                className="text-xs font-medium text-slate-700"
              >
                Target Wholesale Price per 5 Yards (₦)
              </label>
              <span className="font-mono text-xs font-semibold text-emerald-800 tabular-nums">
                {formatNaira(wholesalePrice)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="npi-wholesale-price"
                type="range"
                min={25000}
                max={320000}
                step={1000}
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(Number(e.target.value))}
                className="w-full accent-emerald-800"
              />
              <input
                type="number"
                min={5000}
                max={750000}
                step={500}
                value={wholesalePrice}
                onChange={(e) =>
                  setWholesalePrice(Math.max(1000, Number(e.target.value)))
                }
                className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums"
              />
            </div>
          </div>

          {/* Order Quantity (Bales) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="npi-bales"
                className="text-xs font-medium text-slate-700"
              >
                Order Quantity (Bales)
              </label>
              <span className="font-mono text-xs text-slate-700 tabular-nums">
                {orderBales} bales · {metrics.totalBundles} bundles ·{' '}
                {metrics.totalYards.toLocaleString('en-NG')} yds
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="npi-bales"
                type="range"
                min={1}
                max={50}
                step={1}
                value={orderBales}
                onChange={(e) => setOrderBales(Number(e.target.value))}
                className="w-full accent-emerald-800"
              />
              <input
                type="number"
                min={1}
                max={200}
                value={orderBales}
                onChange={(e) =>
                  setOrderBales(Math.max(1, Number(e.target.value)))
                }
                className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums"
              />
            </div>
          </div>

          {/* Parallel FX Sensitivity Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="npi-fx-rate"
                className="text-xs font-medium text-slate-700"
              >
                Parallel FX Rate Sensitivity (₦ / USD)
              </label>
              <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums">
                ₦{fxRateNgnPerUsd.toLocaleString('en-NG')} / $1
              </span>
            </div>
            <input
              id="npi-fx-rate"
              type="range"
              min={1200}
              max={2300}
              step={10}
              value={fxRateNgnPerUsd}
              onChange={(e) => onFxRateChange(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
              <span>₦1,200</span>
              <span>₦1,750</span>
              <span>₦2,300</span>
            </div>
          </div>

          {/* Target Launch Month */}
          <div>
            <label
              htmlFor="npi-launch-month"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Target Launch Window
            </label>
            <select
              id="npi-launch-month"
              value={targetLaunchMonth}
              onChange={(e) => setTargetLaunchMonth(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              {LAUNCH_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Live Capital Outlay Strip */}
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div>
              <div className="text-[11px] text-slate-500">Capital Outlay</div>
              <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums mt-0.5">
                {formatNairaCompact(metrics.totalCapitalNgn)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Max Gross Spread</div>
              <div
                className={`font-mono text-sm font-semibold tabular-nums mt-0.5 ${
                  metrics.maxGrossProfitNgn >= 0
                    ? 'text-emerald-800'
                    : 'text-rose-700'
                }`}
              >
                {formatNairaCompact(metrics.maxGrossProfitNgn)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Target Margin</div>
              <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums mt-0.5">
                {metrics.marginPct.toFixed(1)}%
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSimulating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {isSimulating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running Gemini Financial Stress Test...
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4" />
                Run NPI Scenario Simulation
              </>
            )}
          </button>
        </form>

        {/* Right: Verdict, Charts, Bulk Discount Tier & Risks */}
        <div className="lg:col-span-7 space-y-5">
          {/* Verdict Card */}
          <div className={`rounded-xl border p-5 ${verdictConfig.box}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold tracking-wide ${verdictConfig.badge}`}
                >
                  <VerdictIcon className="w-3.5 h-3.5" />
                  {activeSimulation.verdict}
                </span>
                <span className="text-xs font-mono text-slate-600 tabular-nums">
                  {activeSimulation.orderBales} bales ·{' '}
                  {activeSimulation.targetLaunchMonth}
                </span>
              </div>
              <span className="font-mono text-xs text-slate-600 tabular-nums">
                FX Anchor: ₦{activeSimulation.fxRateNgnPerUsd.toLocaleString('en-NG')}/USD
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {activeSimulation.laceName} ({activeSimulation.laceVariety})
            </h3>
            <p className="text-sm leading-relaxed text-slate-700 mt-1">
              {activeSimulation.verdictRationale}
            </p>
          </div>

          {/* Interactive Recharts Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Scenario Profit & Sell-Through Modeling
                </h3>
                <p className="text-xs text-slate-500">
                  Best Case, Base Case, and Worst Case projection across 90-day inventory cycle
                </p>
              </div>
              <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setChartView('profit')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    chartView === 'profit'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Net Profit (₦)
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('sellthrough')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    chartView === 'sellthrough'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sell-Through (%)
                </button>
              </div>
            </div>

            <div className="h-64 w-full">
              {chartView === 'profit' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={profitChartData}
                    margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#475569' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(val) => formatNairaCompact(Number(val))}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      width={72}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        formatNaira(Number(value)),
                        'Net Profit',
                      ]}
                      contentStyle={{
                        borderRadius: '8px',
                        borderColor: '#cbd5e1',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="netProfitNgn" radius={[6, 6, 0, 0]} maxBarSize={68}>
                      {profitChartData.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={
                            entry.netProfitNgn < 0
                              ? '#dc2626'
                              : idx === 0
                              ? '#059669'
                              : idx === 1
                              ? '#0f766e'
                              : '#d97706'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={sellThroughData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="horizon"
                      tick={{ fontSize: 12, fill: '#475569' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, 'Sell-Through']}
                      contentStyle={{
                        borderRadius: '8px',
                        borderColor: '#cbd5e1',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line
                      type="monotone"
                      dataKey="Best Case"
                      stroke="#059669"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Base Case"
                      stroke="#0f172a"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Worst Case"
                      stroke="#d97706"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Scenario Table */}
            <div className="mt-5 overflow-x-auto border-t border-slate-100 pt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2 pr-3">Scenario</th>
                    <th className="py-2 px-3 text-right">Net Profit (₦)</th>
                    <th className="py-2 px-3 text-right">Margin</th>
                    <th className="py-2 px-3 text-right">30d</th>
                    <th className="py-2 px-3 text-right">60d</th>
                    <th className="py-2 pl-3 text-right">90d</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {activeSimulation.scenarios.map((row) => (
                    <tr key={row.name} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3 font-medium text-slate-900">
                        {row.name}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-semibold tabular-nums ${
                          row.netProfitNgn >= 0 ? 'text-emerald-800' : 'text-rose-700'
                        }`}
                      >
                        {formatNaira(row.netProfitNgn)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 tabular-nums">
                        {row.grossMarginPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                        {row.sellThrough30d}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                        {row.sellThrough60d}%
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono text-slate-800 font-medium tabular-nums">
                        {row.sellThrough90d}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Aso-Ebi Bulk Discount Tier & Key Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Optimal Aso-Ebi Tier */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                    Optimal Aso-Ebi Bulk Tier
                  </span>
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {activeSimulation.asoEbiDiscountTier.bundleThreshold}
                </h4>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="font-mono text-xl font-semibold text-emerald-900 tabular-nums">
                    {formatNaira(
                      activeSimulation.asoEbiDiscountTier.discountedPricePer5Yards
                    )}
                  </span>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    per 5 yds ({activeSimulation.asoEbiDiscountTier.recommendedDiscountPct}% off)
                  </span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  {activeSimulation.asoEbiDiscountTier.plannerPitch}
                </p>
              </div>
            </div>

            {/* Key Risk Factors */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Key Risk Factors
              </h4>
              <div className="space-y-3">
                {activeSimulation.riskFactors.map((risk, idx) => {
                  const sevClass =
                    risk.severity === 'High'
                      ? 'text-rose-700'
                      : risk.severity === 'Medium'
                      ? 'text-amber-700'
                      : 'text-emerald-800';
                  return (
                    <div
                      key={idx}
                      className="border-b border-slate-100 last:border-0 pb-2.5 last:pb-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">
                          {risk.title}
                        </span>
                        <span className={`text-[11px] font-mono font-semibold ${sevClass}`}>
                          {risk.severity} Risk
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {risk.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {activeSimulation.groundingSources &&
            activeSimulation.groundingSources.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5">
                <div className="text-xs font-medium text-slate-500 mb-2">
                  Live FX & Market Grounding Sources
                </div>
                <div className="flex flex-wrap gap-3">
                  {activeSimulation.groundingSources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-800 hover:text-emerald-950 underline underline-offset-2"
                    >
                      <span className="max-w-[240px] truncate">{src.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
