import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import type { LaceAnalysisItem } from '../data/onitshaSamples';

interface TrendSensorTabProps {
  analyses: LaceAnalysisItem[];
  activeAnalysis: LaceAnalysisItem;
  onSelectAnalysis: (item: LaceAnalysisItem) => void;
  onAnalysisCreated: (item: LaceAnalysisItem) => void;
  onSendToNpi: (item: LaceAnalysisItem) => void;
  onSendToDrape: (item: LaceAnalysisItem) => void;
  getToken: () => Promise<string | null>;
}

function VelocityGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 58;
  const circumference = Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    clamped >= 78 ? '#059669' : clamped >= 55 ? '#d97706' : '#dc2626';
  const velocityTier =
    clamped >= 78 ? 'High Velocity' : clamped >= 55 ? 'Moderate Pull' : 'Slow Turnover';

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <svg viewBox="0 0 140 84" className="w-40 h-24 overflow-visible" aria-label={`Trend velocity ${clamped} out of 100`}>
        <path
          d="M 12 72 A 58 58 0 0 1 128 72"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 12 72 A 58 58 0 0 1 128 72"
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 450ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
        <text
          x="70"
          y="58"
          textAnchor="middle"
          className="fill-slate-900 font-mono text-2xl font-semibold tabular-nums"
        >
          {clamped}
        </text>
        <text
          x="70"
          y="74"
          textAnchor="middle"
          className="fill-slate-500 text-[11px] font-medium"
        >
          {velocityTier}
        </text>
      </svg>
    </div>
  );
}

export const TrendSensorTab: React.FC<TrendSensorTabProps> = ({
  analyses,
  activeAnalysis,
  onSelectAnalysis,
  onAnalysisCreated,
  onSendToNpi,
  onSendToDrape,
  getToken,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [laceName, setLaceName] = useState(activeAnalysis.laceName);
  const [marketLine, setMarketLine] = useState(
    activeAnalysis.marketLine.includes('White House')
      ? 'White House Extension'
      : 'Airport Indian Line'
  );
  const [marketNotes, setMarketNotes] = useState(
    'Upcoming December wedding rush in Enugu and Lagos; checking Aso-Ebi planner interest for 10+ bundle orders.'
  );
  const [uploadedPreview, setUploadedPreview] = useState<string>(activeAnalysis.imageUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a JPG, PNG, or WebP fabric photo or catalog screenshot.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setErrorMsg('Image exceeds 12MB limit. Please compress or upload a smaller photo.');
      return;
    }
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSampleClick = (sample: LaceAnalysisItem) => {
    onSelectAnalysis(sample);
    setLaceName(sample.laceName);
    setMarketLine(
      sample.marketLine.includes('White House')
        ? 'White House Extension'
        : 'Airport Indian Line'
    );
    setMarketNotes(sample.marketNotes);
    setUploadedPreview(sample.imageUrl);
    setErrorMsg(null);
  };

  const runAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/ai/analyze-lace', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          laceName: laceName.trim() || 'Uploaded Lace Swatch',
          marketLine,
          marketNotes,
          imageDataUrl: uploadedPreview,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to analyze lace sample.');
      }

      const newItem: LaceAnalysisItem = {
        id: data.savedId ? `db-${data.savedId}` : `live-${Date.now()}`,
        laceName: laceName.trim() || 'Uploaded Lace Swatch',
        marketLine,
        imageUrl: uploadedPreview,
        marketNotes,
        laceCategory: data.laceCategory,
        trendVelocityScore: data.trendVelocityScore,
        lifecycleStage: data.lifecycleStage,
        trendingColorways: data.trendingColorways || [],
        motifBreakdown: data.motifBreakdown || [],
        merchandisingAdvice: data.merchandisingAdvice,
        groundingSources: data.groundingSources || [],
        createdAt: new Date().toISOString(),
        isPersisted: Boolean(data.savedId),
      };

      onAnalysisCreated(newItem);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to complete Gemini fabric analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const stageStyle =
    activeAnalysis.lifecycleStage === 'Peak Aso-Ebi Demand'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : activeAnalysis.lifecycleStage === 'Emerging'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : 'bg-rose-50 text-rose-900 border-rose-200';

  return (
    <div className="space-y-8">
      {/* Sample Onitsha Main Market Swatch Selector */}
      <section aria-label="Onitsha Main Market Reference Catalog">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Onitsha Main Market Active Swatches
            </h2>
            <p className="text-sm text-slate-500">
              Select a pre-loaded Airport Indian Line or White House Extension sample, or upload a new supplier photo below.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {analyses.length} indexed fabrics
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {analyses.slice(0, 6).map((item) => {
            const isSelected = item.id === activeAnalysis.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSampleClick(item)}
                className={`group text-left rounded-xl border bg-white p-3 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-emerald-700 ${
                  isSelected
                    ? 'border-emerald-700 ring-1 ring-emerald-700 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="relative w-20 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.laceName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900/10 to-amber-500/10 text-emerald-900">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {item.laceName}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {item.laceCategory} · {item.marketLine}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs font-mono tabular-nums">
                      <span className="font-semibold text-emerald-800">
                        Velocity {item.trendVelocityScore}/100
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        /
                      </span>
                      <span className="text-slate-600 truncate">{item.lifecycleStage}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Upload & Market Context Input */}
        <form
          onSubmit={runAnalysis}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Multimodal Fabric & Catalog Upload
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gemini 4 Hydrogen Vision + Google Search Grounding
              </p>
            </div>
          </div>

          {/* Dropzone */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Lace Swatch, Supplier Catalog Page, or Aso-Ebi Screenshot
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) handleFile(dropped);
              }}
              className={`relative rounded-xl border border-dashed transition-colors ${
                isDragging
                  ? 'border-emerald-700 bg-emerald-50/50'
                  : 'border-slate-300 bg-slate-50/70 hover:border-slate-400'
              }`}
            >
              {uploadedPreview ? (
                <div className="p-3">
                  <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-slate-200 border border-slate-200">
                    <img
                      src={uploadedPreview}
                      alt="Uploaded lace fabric preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setUploadedPreview('')}
                      aria-label="Remove fabric image"
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-900/80 text-white hover:bg-slate-900 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Ready for multimodal texture & motif scan
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-medium text-emerald-800 hover:text-emerald-900 underline underline-offset-2"
                    >
                      Replace photo
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-10 px-4 flex flex-col items-center justify-center text-center"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-900/10 text-emerald-800 flex items-center justify-center mb-3">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-800">
                    Drop lace photo here or click to browse
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    JPG, PNG, or WebP from WhatsApp, Instagram, or factory catalog
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          </div>

          {/* Fabric Name & Market Line */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sensor-lace-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Lace Name / Lot Reference
              </label>
              <input
                id="sensor-lace-name"
                type="text"
                value={laceName}
                onChange={(e) => setLaceName(e.target.value)}
                placeholder="e.g. Emerald Gold Swiss Voile"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>
            <div>
              <label
                htmlFor="sensor-market-line"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Onitsha Trading Line
              </label>
              <select
                id="sensor-market-line"
                value={marketLine}
                onChange={(e) => setMarketLine(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="Airport Indian Line">Airport Indian Line</option>
                <option value="White House Extension">White House Extension</option>
                <option value="Main Market Outer Row">Main Market Outer Row</option>
              </select>
            </div>
          </div>

          {/* Market Notes */}
          <div>
            <label
              htmlFor="sensor-market-notes"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Market Intelligence & Buyer Notes
            </label>
            <textarea
              id="sensor-market-notes"
              rows={3}
              value={marketNotes}
              onChange={(e) => setMarketNotes(e.target.value)}
              placeholder="e.g. Upcoming December wedding rush in Enugu and Lagos; checking bridal demand..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isAnalyzing}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning Fabric & Live Search Trends...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Analyze Fabric & Market Velocity
              </>
            )}
          </button>
        </form>

        {/* Right: Structured Intelligence Output */}
        <div className="lg:col-span-7 space-y-5">
          {/* Primary Category & Velocity Header Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{activeAnalysis.marketLine}</span>
                  <span aria-hidden="true">·</span>
                  <span>Lace Category Detected</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {activeAnalysis.laceName}
                </h3>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <span className="text-base font-semibold text-emerald-900">
                    {activeAnalysis.laceCategory}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    |
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${stageStyle}`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    {activeAnalysis.lifecycleStage}
                  </span>
                </div>
              </div>

              <div className="shrink-0 sm:border-l sm:border-slate-100 sm:pl-6">
                <div className="text-xs font-medium text-slate-500 text-center">
                  Trend Velocity Score
                </div>
                <VelocityGauge score={activeAnalysis.trendVelocityScore} />
              </div>
            </div>

            {/* Colorways & Motifs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-5 border-b border-slate-100">
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Trending Colorways
                </h4>
                <ul className="space-y-2">
                  {activeAnalysis.trendingColorways.map((color, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between text-sm text-slate-800 border-b border-slate-100 last:border-0 pb-1.5 last:pb-0"
                    >
                      <span>{color}</span>
                      <span className="font-mono text-xs text-amber-700 tabular-nums">
                        #{idx + 1}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Motif & Construction Breakdown
                </h4>
                <ul className="space-y-2">
                  {activeAnalysis.motifBreakdown.map((motif, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-slate-700 border-b border-slate-100 last:border-0 pb-1.5 last:pb-0"
                    >
                      {motif}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Actionable Onitsha Merchandising Advice */}
            <div className="pt-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Actionable Onitsha Merchandising Advice
              </h4>
              <p className="text-sm leading-relaxed text-slate-700">
                {activeAnalysis.merchandisingAdvice}
              </p>

              {/* Grounding Sources */}
              {activeAnalysis.groundingSources &&
                activeAnalysis.groundingSources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="text-xs font-medium text-slate-500 mb-2">
                      Google Search Grounding References
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {activeAnalysis.groundingSources.map((src, i) => (
                        <a
                          key={i}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-800 hover:text-emerald-950 underline underline-offset-2"
                        >
                          <span className="max-w-[220px] truncate">{src.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              {/* Cross-tab Handoff Actions */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Continue workflow with this fabric profile
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onSendToNpi(activeAnalysis)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    Simulate Bale Economics
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendToDrape(activeAnalysis)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Virtual Drape & Pitch
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
