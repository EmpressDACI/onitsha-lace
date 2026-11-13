import frenchCordImg from '../assets/images/french_cord_champagne_1794571260490.jpg';
import guipureBurgundyImg from '../assets/images/guipure_royal_burgundy_1794571261305.jpg';
import swissVoileImg from '../assets/images/swiss_voile_emerald_gold_1794571260417.jpg';
import type {
  AsoEbiDiscountTier,
  GroundingSource,
  NpiRiskFactor,
  NpiScenarioRow,
} from '../db/schema.ts';

export interface LaceAnalysisItem {
  id: string;
  laceName: string;
  marketLine: string;
  imageUrl: string;
  marketNotes: string;
  laceCategory: string;
  trendVelocityScore: number;
  lifecycleStage: 'Emerging' | 'Peak Aso-Ebi Demand' | 'Saturating';
  trendingColorways: string[];
  motifBreakdown: string[];
  merchandisingAdvice: string;
  groundingSources: GroundingSource[];
  createdAt: string;
  isPersisted?: boolean;
}

export interface NpiSimulationItem {
  id: string;
  laceName: string;
  laceVariety: string;
  landedCostPer5Yards: number;
  targetWholesalePrice: number;
  orderBales: number;
  fxRateNgnPerUsd: number;
  targetLaunchMonth: string;
  verdict: 'GO — High Margin' | 'TEST SMALL BATCH' | 'NO-GO — Dead-Stock Risk';
  verdictRationale: string;
  scenarios: NpiScenarioRow[];
  asoEbiDiscountTier: AsoEbiDiscountTier;
  riskFactors: NpiRiskFactor[];
  groundingSources: GroundingSource[];
  createdAt: string;
  isPersisted?: boolean;
}

export interface DrapePitchItem {
  id: string;
  laceName: string;
  garmentStyle: "Women's Iro & Buba / Corset Aso-Ebi Gown" | "Men's Agbada / Senator Style";
  imageSize: '1K' | '2K' | '4K';
  mockupImageUrl: string;
  whatsappCopy: string;
  targetAudience: string;
  createdAt: string;
  isPersisted?: boolean;
}

export const SAMPLE_LACE_ANALYSES: LaceAnalysisItem[] = [
  {
    id: 'sample-swiss-voile',
    laceName: 'Royal Emerald Metallic Swiss Voile',
    marketLine: 'Airport Indian Line · Block C',
    imageUrl: swissVoileImg,
    marketNotes:
      'Upcoming December Igba Nkwu & Lagos Owambe wedding rush; buyers requesting breathable gold-embroidered cotton voile.',
    laceCategory: 'Swiss Voile',
    trendVelocityScore: 89,
    lifecycleStage: 'Peak Aso-Ebi Demand',
    trendingColorways: [
      'Deep Emerald & Champagne Gold',
      'Forest Green & Antique Bronze',
      'Teal & Warm Ivory',
    ],
    motifBreakdown: [
      'Dense metallic gold floral filigree',
      'Breathable Swiss eyelet cutwork border',
      'Scalloped double-hem edging',
    ],
    merchandisingAdvice:
      'Prioritize 12-bundle bales on Airport Indian Line before mid-November. Pair emerald base with champagne or burnt-orange George headties for Enugu and Owerri Igba Nkwu planners. Keep markup disciplined around 26% for 10+ bundle Aso-Ebi bookings to lock in cashflow before December.',
    groundingSources: [],
    createdAt: '2026-11-12T10:15:00.000Z',
  },
  {
    id: 'sample-french-cord',
    laceName: 'Champagne Pearl Beaded French Cord',
    marketLine: 'White House Extension · Zone 2',
    imageUrl: frenchCordImg,
    marketNotes:
      'Targeting Abuja & Lekki bridal train / mother-of-the-bride boutiques looking for elevated neutral tones.',
    laceCategory: 'French Beaded/Sequined',
    trendVelocityScore: 84,
    lifecycleStage: 'Emerging',
    trendingColorways: [
      'Champagne Ivory & Rose Gold',
      'Warm Cream & Antique Gold',
      'Soft Taupe & Pearl White',
    ],
    motifBreakdown: [
      'Raised metallic cording swirls',
      'Hand-tacked faux pearl clusters',
      'Micro-sequin catchlight highlights on tulle mesh',
    ],
    merchandisingAdvice:
      'Stock selectively in 5-to-8 bale lots for White House Extension bridal wholesalers. Avoid deep discounting—Abuja and Lagos couture tailors pay premium margins for intact pearl beading on low-stretch tulle.',
    groundingSources: [],
    createdAt: '2026-11-11T15:40:00.000Z',
  },
  {
    id: 'sample-guipure-burgundy',
    laceName: 'Imperial Burgundy Medallion Guipure',
    marketLine: 'Airport Indian Line · Lane 4',
    imageUrl: guipureBurgundyImg,
    marketNotes:
      'Heavy chemical lace for chieftaincy title ceremonies and Christmas homecoming events across Anambra and Imo.',
    laceCategory: 'Guipure',
    trendVelocityScore: 68,
    lifecycleStage: 'Saturating',
    trendingColorways: [
      'Royal Burgundy & Burnished Gold',
      'Wine Red & Champagne',
      'Plum & Copper Thread',
    ],
    motifBreakdown: [
      'Heavyweight geometric floral medallions',
      'Dense gold satin-stitch outlining',
      'Zero-mesh open chemical lace lattice',
    ],
    merchandisingAdvice:
      'Burgundy medallion Guipure faces fast local poly-copying along Main Market outer rows. Clear existing White House Extension stock via 10+ bundle Aso-Ebi discounts rather than reordering full containers at current FX.',
    groundingSources: [],
    createdAt: '2026-11-10T09:20:00.000Z',
  },
];

export const SAMPLE_NPI_SIMULATIONS: NpiSimulationItem[] = [
  {
    id: 'sample-npi-1',
    laceName: 'Royal Emerald Metallic Swiss Voile',
    laceVariety: 'Swiss Voile',
    landedCostPer5Yards: 62000,
    targetWholesalePrice: 84000,
    orderBales: 12,
    fxRateNgnPerUsd: 1680,
    targetLaunchMonth: 'December (Detty December & Igba Nkwu)',
    verdict: 'GO — High Margin',
    verdictRationale:
      'At ₦62,000 landed cost and ₦84,000 wholesale price across 12 bales (144 bundles), unit spread of ₦22,000 per 5 yards absorbs a 5% parallel FX wobble while capturing peak December Igba Nkwu and Lagos Owambe demand.',
    scenarios: [
      {
        name: 'Best Case',
        netProfitNgn: 3045600,
        grossMarginPct: 26.2,
        sellThrough30d: 68,
        sellThrough60d: 94,
        sellThrough90d: 100,
      },
      {
        name: 'Base Case',
        netProfitNgn: 2498400,
        grossMarginPct: 23.4,
        sellThrough30d: 52,
        sellThrough60d: 82,
        sellThrough90d: 96,
      },
      {
        name: 'Worst Case',
        netProfitNgn: 1188000,
        grossMarginPct: 14.1,
        sellThrough30d: 31,
        sellThrough60d: 58,
        sellThrough90d: 79,
      },
    ],
    asoEbiDiscountTier: {
      bundleThreshold: '10+ Bundles (50+ Yards Event Tier)',
      recommendedDiscountPct: 6,
      discountedPricePer5Yards: 78960,
      plannerPitch:
        'Lock in 10+ bundles at ₦78,960 per 5 yards (save ₦5,040/bundle) with same-day Onitsha-to-Lagos/Abuja waybill dispatch via GUO or Peace Mass Logistics.',
    },
    riskFactors: [
      {
        title: 'Parallel FX Settlement Squeeze',
        severity: 'Medium',
        detail:
          'Every ₦50/USD depreciation adds ~₦1,845 to landed cost per 5 yards if supplier balance is settled on delivery rather than hedged upfront.',
      },
      {
        title: 'Rapid Aba / Kano Imitation Cycle',
        severity: 'Medium',
        detail:
          'High-velocity gold-on-emerald motifs typically see lower-weight copies within 6–8 weeks; move 75%+ of bales before mid-January.',
      },
      {
        title: 'December Port & Road Haulage Bottleneck',
        severity: 'Low',
        detail:
          'Apapa/Onne clearing plus Benin-Ore-Onitsha transit delays require clearing goods at least 18 days prior to peak wedding weekends.',
      },
    ],
    groundingSources: [],
    createdAt: '2026-11-12T11:00:00.000Z',
  },
];

export const SAMPLE_DRAPE_PITCHES: DrapePitchItem[] = [
  {
    id: 'sample-pitch-1',
    laceName: 'Royal Emerald Metallic Swiss Voile',
    garmentStyle: "Women's Iro & Buba / Corset Aso-Ebi Gown",
    imageSize: '1K',
    mockupImageUrl: swissVoileImg,
    targetAudience: 'Lagos & Abuja Boutique Owners / Aso-Ebi Planners',
    whatsappCopy: `*FRESH LANDING AT ONITSHA MAIN MARKET (AIRPORT INDIAN LINE)*

*ROYAL EMERALD METALLIC SWISS VOILE — 2026 OWAMBE & IGBA NKWU EDITION*

Sisters & Chief Planners, this fresh Swiss cotton voile just cleared! Zero itch, breathable 100% Swiss base, heavy 24k-tone gold embroidery with crisp scalloped edges that sit effortlessly on corset Aso-Ebi gowns and classic Iro & Buba.

*WHOLESALE BREAKDOWN (5 YARDS PER BUNDLE):*
- Single Bundle (5 Yards): *₦84,000*
- Aso-Ebi Bulk Tier (10+ Bundles): *₦78,960 / 5 Yards* (Save ₦5,040 per bundle!)
- Full Bale (12 Bundles / 60 Yards): Call for direct importer crate rate

*AVAILABLE COLORS:* Deep Emerald/Gold, Champagne/Rose Gold, Royal Burgundy/Gold.

Same-day waybill to *Lagos (Balogun/Lekki), Abuja (Wuse II), Port Harcourt & Enugu* via GUO / Peace Mass Logistics.

Reply *"RESERVE EMERALD"* + number of bundles now before December bridal groups clear this batch!`,
    createdAt: '2026-11-12T12:15:00.000Z',
  },
];
