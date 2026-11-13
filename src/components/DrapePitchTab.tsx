import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import type { DrapePitchItem, LaceAnalysisItem } from '../data/onitshaSamples';
import { formatNaira } from '../utils/formatters';

interface DrapePitchTabProps {
  activeAnalysis: LaceAnalysisItem;
  analyses: LaceAnalysisItem[];
  activePitch: DrapePitchItem;
  defaultWholesalePrice: number;
  defaultAsoEbiPrice?: number;
  onPitchCreated: (item: DrapePitchItem) => void;
  getToken: () => Promise<string | null>;
}

const GARMENT_STYLES: Array<
  "Women's Iro & Buba / Corset Aso-Ebi Gown" | "Men's Agbada / Senator Style"
> = [
  "Women's Iro & Buba / Corset Aso-Ebi Gown",
  "Men's Agbada / Senator Style",
];

const IMAGE_SIZES: Array<'1K' | '2K' | '4K'> = ['1K', '2K', '4K'];

export const DrapePitchTab: React.FC<DrapePitchTabProps> = ({
  activeAnalysis,
  analyses,
  activePitch,
  defaultWholesalePrice,
  defaultAsoEbiPrice,
  onPitchCreated,
  getToken,
}) => {
  const [selectedLaceId, setSelectedLaceId] = useState(activeAnalysis.id);
  const [garmentStyle, setGarmentStyle] = useState<
    "Women's Iro & Buba / Corset Aso-Ebi Gown" | "Men's Agbada / Senator Style"
  >(activePitch.garmentStyle);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [targetAudience, setTargetAudience] = useState(
    'Lagos & Abuja Boutique Owners / Aso-Ebi Planners'
  );
  const [wholesalePrice, setWholesalePrice] = useState(defaultWholesalePrice);
  const [asoEbiPrice, setAsoEbiPrice] = useState(
    defaultAsoEbiPrice || Math.round(defaultWholesalePrice * 0.94)
  );
  const [urgencyNotes, setUrgencyNotes] = useState(
    'Fresh container arrival at Airport Indian Line; limited bales before December bridal peak.'
  );

  const [mockupUrl, setMockupUrl] = useState(activePitch.mockupImageUrl);
  const [whatsappCopy, setWhatsappCopy] = useState(activePitch.whatsappCopy);
  const [isGeneratingDrape, setIsGeneratingDrape] = useState(false);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setSelectedLaceId(activeAnalysis.id);
  }, [activeAnalysis.id]);

  useEffect(() => {
    setWholesalePrice(defaultWholesalePrice);
    setAsoEbiPrice(
      defaultAsoEbiPrice || Math.round(defaultWholesalePrice * 0.94)
    );
  }, [defaultWholesalePrice, defaultAsoEbiPrice]);

  const currentLace =
    analyses.find((a) => a.id === selectedLaceId) || activeAnalysis;

  const handleGenerateDrape = async () => {
    setIsGeneratingDrape(true);
    setErrorMsg(null);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/ai/generate-drape', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          laceName: currentLace.laceName,
          laceCategory: currentLace.laceCategory,
          colorways: currentLace.trendingColorways,
          garmentStyle,
          imageSize,
          imageDataUrl: currentLace.imageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to generate AI fashion drape.');
      }

      setMockupUrl(data.mockupImageUrl);
      onPitchCreated({
        id: `drape-${Date.now()}`,
        laceName: currentLace.laceName,
        garmentStyle,
        imageSize,
        mockupImageUrl: data.mockupImageUrl,
        whatsappCopy,
        targetAudience,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'Virtual drape generation failed. Verify your paid Gemini API key in Settings > Secrets.'
      );
    } finally {
      setIsGeneratingDrape(false);
    }
  };

  const handleGenerateWhatsapp = async () => {
    setIsGeneratingCopy(true);
    setErrorMsg(null);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/ai/generate-whatsapp', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          laceName: currentLace.laceName,
          laceCategory: currentLace.laceCategory,
          marketLine: currentLace.marketLine,
          wholesalePriceNgn: wholesalePrice,
          asoEbiDiscountPriceNgn: asoEbiPrice,
          garmentStyle,
          targetAudience,
          colorways: currentLace.trendingColorways,
          urgencyNotes,
          mockupImageUrl: mockupUrl,
          imageSize,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to generate WhatsApp broadcast.');
      }

      setWhatsappCopy(data.whatsappCopy);
      onPitchCreated({
        id: data.savedId ? `db-${data.savedId}` : `pitch-${Date.now()}`,
        laceName: currentLace.laceName,
        garmentStyle,
        imageSize,
        mockupImageUrl: mockupUrl,
        whatsappCopy: data.whatsappCopy,
        targetAudience,
        createdAt: new Date().toISOString(),
        isPersisted: Boolean(data.savedId),
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to generate WhatsApp sales copy.');
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const handleCopyWhatsapp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setErrorMsg('Clipboard access blocked by browser. Select text and copy manually.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Drape & Broadcast Controls */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Virtual Drape & Pitch Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tailored lookbook render via Gemini 3 Pro Image + WhatsApp broadcast copy
          </p>
        </div>

        {/* Fabric Selector */}
        <div>
          <label
            htmlFor="drape-fabric-select"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Select Analyzed Lace Fabric
          </label>
          <select
            id="drape-fabric-select"
            value={selectedLaceId}
            onChange={(e) => setSelectedLaceId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
          >
            {analyses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.laceName} ({a.laceCategory})
              </option>
            ))}
          </select>
        </div>

        {/* Garment Style */}
        <div>
          <span className="block text-xs font-medium text-slate-700 mb-2">
            Nigerian Traditional Tailored Silhouette
          </span>
          <div className="grid grid-cols-1 gap-2">
            {GARMENT_STYLES.map((style) => {
              const active = garmentStyle === style;
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => setGarmentStyle(style)}
                  className={`text-left rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-emerald-800 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {style}
                </button>
              );
            })}
          </div>
        </div>

        {/* Image Resolution Selector (1K, 2K, 4K) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-700">
              Studio Output Resolution (Gemini 3 Pro Image)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Aspect 3:4
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 p-1 rounded-lg bg-slate-100">
            {IMAGE_SIZES.map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setImageSize(sz)}
                className={`py-2 text-xs font-mono font-semibold rounded-md transition-colors ${
                  imageSize === sz
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerateDrape}
          disabled={isGeneratingDrape}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors whitespace-nowrap"
        >
          {isGeneratingDrape ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Tailoring {imageSize} Virtual Drape...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate {imageSize} AI Fashion Mockup
            </>
          )}
        </button>

        {/* WhatsApp Broadcast Inputs */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            WhatsApp Broadcast Parameters
          </h3>

          <div>
            <label
              htmlFor="wa-audience"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Target Buyer Segment
            </label>
            <select
              id="wa-audience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              <option value="Lagos & Abuja Boutique Owners / Aso-Ebi Planners">
                Lagos & Abuja Boutique Owners / Aso-Ebi Planners
              </option>
              <option value="Enugu, Owerri & Awka Igba Nkwu Bridal Groups">
                Enugu, Owerri & Awka Igba Nkwu Bridal Groups
              </option>
              <option value="Port Harcourt & Warri Luxury Fabric Wholesalers">
                Port Harcourt & Warri Luxury Fabric Wholesalers
              </option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="wa-wholesale-price"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Bundle Price (₦ / 5 yds)
              </label>
              <input
                id="wa-wholesale-price"
                type="number"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="wa-bulk-price"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                10+ Bundle Rate (₦)
              </label>
              <input
                id="wa-bulk-price"
                type="number"
                value={asoEbiPrice}
                onChange={(e) => setAsoEbiPrice(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="wa-urgency"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Stock & Waybill Urgency Note
            </label>
            <input
              id="wa-urgency"
              type="text"
              value={urgencyNotes}
              onChange={(e) => setUrgencyNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerateWhatsapp}
            disabled={isGeneratingCopy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {isGeneratingCopy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Writing Nigerian Wholesale Copy...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" />
                Generate WhatsApp Broadcast Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right: Studio Output Canvas */}
      <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Tailored AI Fashion Mockup */}
        <div className="md:col-span-6 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Tailored Lookbook Mockup
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[210px]">
                {garmentStyle}
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {imageSize}
            </span>
          </div>

          <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
            {isGeneratingDrape ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-800 mb-3" />
                <div className="text-sm font-medium text-slate-800">
                  Rendering {imageSize} tailored silhouette
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Applying {currentLace.laceName} pattern weave...
                </div>
              </div>
            ) : mockupUrl ? (
              <img
                src={mockupUrl}
                alt={`${currentLace.laceName} tailored into ${garmentStyle}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="text-xs">No preview generated yet</span>
              </div>
            )}
          </div>

          {mockupUrl && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-mono tabular-nums">
                {formatNaira(wholesalePrice)} / 5 yds
              </span>
              <a
                href={mockupUrl}
                download={`${currentLace.laceName
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '_')}_drape_${imageSize}.png`}
                className="inline-flex items-center gap-1 font-medium text-emerald-800 hover:text-emerald-950"
              >
                <Download className="w-3.5 h-3.5" />
                Download Mockup
              </a>
            </div>
          )}
        </div>

        {/* WhatsApp Broadcast Copy Studio */}
        <div className="md:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  WhatsApp Broadcast Copy
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ready for Lagos & Abuja buyer lists
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyWhatsapp}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  copied
                    ? 'bg-emerald-800 text-white'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy for WhatsApp
                  </>
                )}
              </button>
            </div>

            <textarea
              aria-label="WhatsApp Broadcast Copy Editor"
              rows={17}
              value={whatsappCopy}
              onChange={(e) => setWhatsappCopy(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 text-xs leading-relaxed text-slate-800 font-sans focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Supports *bold* WhatsApp formatting</span>
            <span className="font-mono tabular-nums">
              {whatsappCopy.length} chars
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
