import React, { useEffect, useState } from 'react';
import { LogIn, LogOut, Sparkles } from 'lucide-react';
import { DrapePitchTab } from './components/DrapePitchTab';
import { NpiSimulatorTab } from './components/NpiSimulatorTab';
import { TrendAlertPanel } from './components/TrendAlertPanel';
import { TrendSensorTab } from './components/TrendSensorTab';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  SAMPLE_DRAPE_PITCHES,
  SAMPLE_LACE_ANALYSES,
  SAMPLE_NPI_SIMULATIONS,
  type DrapePitchItem,
  type LaceAnalysisItem,
  type NpiSimulationItem,
} from './data/onitshaSamples';
import { useTrendAlerts, type TrendAlertItem } from './hooks/useTrendAlerts';

type TabKey = 'sensor' | 'npi' | 'drape';

function DashboardShell() {
  const { user, loading: authLoading, authError, getToken, signInWithGoogle, signOut } =
    useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('sensor');
  const [analyses, setAnalyses] = useState<LaceAnalysisItem[]>(SAMPLE_LACE_ANALYSES);
  const [activeAnalysis, setActiveAnalysis] = useState<LaceAnalysisItem>(
    SAMPLE_LACE_ANALYSES[0]
  );

  const [simulations, setSimulations] = useState<NpiSimulationItem[]>(
    SAMPLE_NPI_SIMULATIONS
  );
  const [activeSimulation, setActiveSimulation] = useState<NpiSimulationItem>(
    SAMPLE_NPI_SIMULATIONS[0]
  );

  const [pitches, setPitches] = useState<DrapePitchItem[]>(SAMPLE_DRAPE_PITCHES);
  const [activePitch, setActivePitch] = useState<DrapePitchItem>(
    SAMPLE_DRAPE_PITCHES[0]
  );

  const [fxRateNgnPerUsd, setFxRateNgnPerUsd] = useState<number>(1680);
  const [npiPrefillName, setNpiPrefillName] = useState<string | undefined>(undefined);
  const [npiPrefillVariety, setNpiPrefillVariety] = useState<string | undefined>(
    undefined
  );

  const {
    alerts,
    unreadCount,
    threshold,
    connectionStatus,
    latestToast,
    isScanningPulse,
    pulseStatusNote,
    soundEnabled,
    desktopPermission,
    setSoundEnabled,
    dismissToast,
    mergePersistedAlerts,
    updateThreshold,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    requestDesktopPermission,
    runLivePulseScan,
  } = useTrendAlerts(getToken);

  // Sync user's Cloud SQL saved records upon sign-in
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadWorkspace = async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      try {
        const res = await fetch('/api/workspace', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (Array.isArray(data.analyses) && data.analyses.length > 0) {
          const mapped: LaceAnalysisItem[] = data.analyses.map((row: any) => ({
            id: `db-${row.id}`,
            laceName: row.laceName,
            marketLine: row.marketLine,
            imageUrl: row.imageUrl || SAMPLE_LACE_ANALYSES[0].imageUrl,
            marketNotes: row.marketNotes || '',
            laceCategory: row.laceCategory,
            trendVelocityScore: row.trendVelocityScore,
            lifecycleStage: row.lifecycleStage,
            trendingColorways: row.trendingColorways || [],
            motifBreakdown: row.motifBreakdown || [],
            merchandisingAdvice: row.merchandisingAdvice,
            groundingSources: row.groundingSources || [],
            createdAt: row.createdAt || new Date().toISOString(),
            isPersisted: true,
          }));
          setAnalyses([...mapped, ...SAMPLE_LACE_ANALYSES]);
          setActiveAnalysis(mapped[0]);
        }

        if (Array.isArray(data.simulations) && data.simulations.length > 0) {
          const mappedSims: NpiSimulationItem[] = data.simulations.map((row: any) => ({
            id: `db-${row.id}`,
            laceName: row.laceName,
            laceVariety: row.laceVariety,
            landedCostPer5Yards: row.landedCostPer5Yards,
            targetWholesalePrice: row.targetWholesalePrice,
            orderBales: row.orderBales,
            fxRateNgnPerUsd: row.fxRateNgnPerUsd,
            targetLaunchMonth: row.targetLaunchMonth,
            verdict: row.verdict,
            verdictRationale: row.verdictRationale,
            scenarios: row.scenarios || [],
            asoEbiDiscountTier: row.asoEbiDiscountTier,
            riskFactors: row.riskFactors || [],
            groundingSources: row.groundingSources || [],
            createdAt: row.createdAt || new Date().toISOString(),
            isPersisted: true,
          }));
          setSimulations([...mappedSims, ...SAMPLE_NPI_SIMULATIONS]);
          setActiveSimulation(mappedSims[0]);
        }

        if (Array.isArray(data.pitches) && data.pitches.length > 0) {
          const mappedPitches: DrapePitchItem[] = data.pitches.map((row: any) => ({
            id: `db-${row.id}`,
            laceName: row.laceName,
            garmentStyle: row.garmentStyle,
            imageSize: row.imageSize,
            mockupImageUrl: row.mockupImageUrl,
            whatsappCopy: row.whatsappCopy,
            targetAudience: row.targetAudience,
            createdAt: row.createdAt || new Date().toISOString(),
            isPersisted: true,
          }));
          setPitches([...mappedPitches, ...SAMPLE_DRAPE_PITCHES]);
          setActivePitch(mappedPitches[0]);
        }

        if (Array.isArray(data.alerts) && data.alerts.length > 0) {
          const mappedAlerts: TrendAlertItem[] = data.alerts.map((row: any) => ({
            alertKey: row.alertKey,
            laceName: row.laceName,
            laceCategory: row.laceCategory,
            marketLine: row.marketLine,
            trendVelocityScore: row.trendVelocityScore,
            lifecycleStage: row.lifecycleStage,
            recommendedAction: row.recommendedAction,
            trendingColorways: row.trendingColorways || [],
            isRead: Boolean(row.isRead),
            createdAt: row.createdAt || new Date().toISOString(),
          }));
          mergePersistedAlerts(mappedAlerts);
        }
      } catch {
        // Silently preserve sample state if workspace sync is unavailable
      }
    };

    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleAnalysisCreated = (item: LaceAnalysisItem) => {
    setAnalyses((prev) => [item, ...prev]);
    setActiveAnalysis(item);
  };

  const handleSimulationCreated = (item: NpiSimulationItem) => {
    setSimulations((prev) => [item, ...prev]);
    setActiveSimulation(item);
  };

  const handlePitchCreated = (item: DrapePitchItem) => {
    setPitches((prev) => [item, ...prev]);
    setActivePitch(item);
  };

  const handleSendToNpi = (item: LaceAnalysisItem) => {
    setNpiPrefillName(item.laceName);
    setNpiPrefillVariety(item.laceCategory);
    setActiveTab('npi');
  };

  const handleSendToDrape = (item: LaceAnalysisItem) => {
    setActiveAnalysis(item);
    setActiveTab('drape');
  };

  const handleSimulateAlertInNpi = (alert: TrendAlertItem) => {
    setNpiPrefillName(alert.laceName);
    setNpiPrefillVariety(alert.laceCategory);
    setActiveTab('npi');
  };

  const handlePitchAlertInStudio = (alert: TrendAlertItem) => {
    const existing = analyses.find((a) => a.laceName === alert.laceName);
    if (existing) {
      setActiveAnalysis(existing);
    } else {
      const synthesized: LaceAnalysisItem = {
        id: `alert-${alert.alertKey}`,
        laceName: alert.laceName,
        marketLine: alert.marketLine,
        imageUrl: SAMPLE_LACE_ANALYSES[0].imageUrl,
        marketNotes: alert.recommendedAction,
        laceCategory: alert.laceCategory,
        trendVelocityScore: alert.trendVelocityScore,
        lifecycleStage:
          alert.lifecycleStage === 'Emerging' ||
          alert.lifecycleStage === 'Peak Aso-Ebi Demand' ||
          alert.lifecycleStage === 'Saturating'
            ? alert.lifecycleStage
            : 'Peak Aso-Ebi Demand',
        trendingColorways: alert.trendingColorways,
        motifBreakdown: ['High-demand Aso-Ebi surge pattern'],
        merchandisingAdvice: alert.recommendedAction,
        groundingSources: [],
        createdAt: alert.createdAt,
      };
      setAnalyses((prev) => [synthesized, ...prev]);
      setActiveAnalysis(synthesized);
    }
    setActiveTab('drape');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Three-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('sensor')}
            className="font-display text-lg font-bold tracking-tight text-emerald-950 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            Onitsha LacePulse AI
          </button>

          {/* Zone 2: Clean Single-Line Navigation Links */}
          <nav
            aria-label="Primary Workspace Modules"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setActiveTab('sensor')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'sensor'
                  ? 'border-emerald-800 text-emerald-950 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Market & Trend Sensor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('npi')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'npi'
                  ? 'border-emerald-800 text-emerald-950 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              NPI Simulator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('drape')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'drape'
                  ? 'border-emerald-800 text-emerald-950 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Drape & WhatsApp Studio
            </button>
          </nav>

          {/* Zone 3: Primary Account Action */}
          <div className="flex items-center gap-3 shrink-0">
            {authLoading ? (
              <span className="text-xs text-slate-400 whitespace-nowrap">Loading...</span>
            ) : user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-xs font-medium text-slate-700 max-w-[160px] truncate">
                  {user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-900 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in with Google
              </button>
            )}
          </div>
        </div>

        {/* Mobile Tab Navigation Strip */}
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('sensor')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 ${
              activeTab === 'sensor'
                ? 'bg-emerald-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Trend Sensor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('npi')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 ${
              activeTab === 'npi'
                ? 'bg-emerald-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            NPI Simulator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drape')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 ${
              activeTab === 'drape'
                ? 'bg-emerald-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Drape & WhatsApp
          </button>
        </div>
      </header>

      {/* Executive Market Context Strip */}
      <div className="bg-emerald-950 text-slate-100 border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-amber-400">
              Onitsha Main Market Desk
            </span>
            <span aria-hidden="true" className="text-emerald-700">
              /
            </span>
            <span className="text-slate-200">
              Airport Indian Line & White House Extension
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono tabular-nums text-slate-200">
            <span>
              Parallel FX Anchor:{' '}
              <strong className="text-amber-300">
                ₦{fxRateNgnPerUsd.toLocaleString('en-NG')}/USD
              </strong>
            </span>
            <span aria-hidden="true" className="text-emerald-700">
              ·
            </span>
            <span>1 Bale = 60 yds (12 × 5-yd Bundles)</span>
            {user && (
              <>
                <span aria-hidden="true" className="text-emerald-700">
                  ·
                </span>
                <span className="text-emerald-300">
                  Saved Runs: {analyses.length + simulations.length + pitches.length}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Real-Time Aso-Ebi Trend Alert Toolbar, Live Toast & Drawer */}
      <TrendAlertPanel
        alerts={alerts}
        unreadCount={unreadCount}
        threshold={threshold}
        connectionStatus={connectionStatus}
        latestToast={latestToast}
        isScanningPulse={isScanningPulse}
        pulseStatusNote={pulseStatusNote}
        soundEnabled={soundEnabled}
        desktopPermission={desktopPermission}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        onUpdateThreshold={updateThreshold}
        onAcknowledgeAlert={acknowledgeAlert}
        onAcknowledgeAll={acknowledgeAllAlerts}
        onRequestDesktopPermission={requestDesktopPermission}
        onRunLivePulseScan={() => runLivePulseScan()}
        onDismissToast={dismissToast}
        onSimulateAlertInNpi={handleSimulateAlertInNpi}
        onPitchAlertInStudio={handlePitchAlertInStudio}
      />

      {authError && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            {authError}
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-7">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {activeTab === 'sensor' && 'Market & Trend Sensor'}
              {activeTab === 'npi' && 'New Product Introduction (NPI) Simulator'}
              {activeTab === 'drape' && 'Virtual Drape & WhatsApp Pitch Studio'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {activeTab === 'sensor' &&
                'Multimodal lace classification, live Aso-Ebi trend velocity scoring, and Onitsha wholesale merchandising guidance.'}
              {activeTab === 'npi' &&
                'Model Naira landed costs, bale commitments, parallel FX squeeze, and 30/60/90-day sell-through scenarios.'}
              {activeTab === 'drape' &&
                'Render 1K–4K tailored Nigerian outfits from your fabric swatch and generate ready-to-send Lagos/Abuja WhatsApp pitches.'}
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>
              Active Lot:{' '}
              <strong className="text-slate-800">{activeAnalysis.laceName}</strong>
            </span>
          </div>
        </div>

        {activeTab === 'sensor' && (
          <TrendSensorTab
            analyses={analyses}
            activeAnalysis={activeAnalysis}
            onSelectAnalysis={setActiveAnalysis}
            onAnalysisCreated={handleAnalysisCreated}
            onSendToNpi={handleSendToNpi}
            onSendToDrape={handleSendToDrape}
            getToken={getToken}
          />
        )}

        {activeTab === 'npi' && (
          <NpiSimulatorTab
            activeSimulation={activeSimulation}
            simulations={simulations}
            prefillLaceName={npiPrefillName}
            prefillLaceVariety={npiPrefillVariety}
            fxRateNgnPerUsd={fxRateNgnPerUsd}
            onFxRateChange={setFxRateNgnPerUsd}
            onSimulationCreated={handleSimulationCreated}
            onSelectSimulation={setActiveSimulation}
            getToken={getToken}
          />
        )}

        {activeTab === 'drape' && (
          <DrapePitchTab
            activeAnalysis={activeAnalysis}
            analyses={analyses}
            activePitch={activePitch}
            defaultWholesalePrice={activeSimulation.targetWholesalePrice}
            defaultAsoEbiPrice={
              activeSimulation.asoEbiDiscountTier.discountedPricePer5Yards
            }
            onPitchCreated={handlePitchCreated}
            getToken={getToken}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Onitsha LacePulse AI · Wholesale Textile Intelligence for Airport Indian Line & White House Extension
          </span>
          <span className="font-mono tabular-nums">All values formatted in NGN (₦)</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardShell />
    </AuthProvider>
  );
}
