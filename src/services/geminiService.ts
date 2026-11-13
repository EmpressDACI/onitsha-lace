import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AsoEbiDiscountTier,
  GroundingSource,
  NpiRiskFactor,
  NpiScenarioRow,
} from '../db/schema.ts';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function extractGroundingSources(response: any): GroundingSource[] {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    const title = chunk?.web?.title;
    if (typeof uri === 'string' && uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({
        uri,
        title: typeof title === 'string' && title ? title : uri,
      });
    }
  }
  return sources.slice(0, 6);
}

function parseJsonSafe<T>(rawText: string | undefined): T {
  if (!rawText) {
    throw new Error('Model returned an empty response.');
  }
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const jsonSlice =
    firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;
  return JSON.parse(jsonSlice) as T;
}

async function resolveImagePart(
  imageDataUrl?: string
): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  if (!imageDataUrl) return null;

  if (imageDataUrl.startsWith('data:')) {
    const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return {
      inlineData: {
        mimeType: match[1],
        data: match[2],
      },
    };
  }

  if (
    imageDataUrl.startsWith('/src/assets/images/') ||
    imageDataUrl.startsWith('/assets/')
  ) {
    const fileName = path.basename(imageDataUrl);
    const imagesDir = path.resolve(process.cwd(), 'src', 'assets', 'images');
    try {
      const entries = await fs.readdir(imagesDir);
      const exact = entries.find((f) => f === fileName);
      const prefixMatch =
        exact ||
        entries.find((f) => {
          const stem = f.replace(/\.[^.]+$/, '');
          return fileName.startsWith(stem);
        });
      if (!prefixMatch) return null;
      const fullPath = path.join(imagesDir, prefixMatch);
      const bytes = await fs.readFile(fullPath);
      const ext = path.extname(prefixMatch).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      return {
        inlineData: {
          mimeType,
          data: bytes.toString('base64'),
        },
      };
    } catch {
      return null;
    }
  }

  return null;
}

export interface AnalyzeLaceInput {
  laceName: string;
  marketLine: string;
  marketNotes: string;
  imageDataUrl?: string;
}

export interface AnalyzeLaceOutput {
  laceCategory: string;
  trendVelocityScore: number;
  lifecycleStage: 'Emerging' | 'Peak Aso-Ebi Demand' | 'Saturating';
  trendingColorways: string[];
  motifBreakdown: string[];
  merchandisingAdvice: string;
  groundingSources: GroundingSource[];
}

export async function analyzeLaceWithGemini(
  input: AnalyzeLaceInput
): Promise<AnalyzeLaceOutput> {
  const imagePart = await resolveImagePart(input.imageDataUrl);
  const promptText = `You are a senior Nigerian textile buyer and retail intelligence analyst serving wholesale lace importers in Onitsha Main Market (Airport Indian Line and White House Extension).

Analyze this lace fabric submission and current Nigerian Aso-Ebi / Owambe / Igba Nkwu market trends using Google Search to verify live 2026 Nigerian wedding and traditional fashion fabric demand:
- Lace Name / Reference: ${input.laceName || 'Unlabeled Sample'}
- Market Line: ${input.marketLine || 'Airport Indian Line'}
- Trader Market Notes: ${input.marketNotes || 'General wholesale stock evaluation for Lagos, Abuja, and South-East buyers.'}

Return a JSON object with:
1. "laceCategory": Exact category among "Swiss Voile", "Cord Lace", "Guipure", "French Beaded/Sequined", or "Dry Lace" (or closest specific hybrid).
2. "trendVelocityScore": Integer 0-100 reflecting current demand momentum across Lagos, Abuja, Enugu, and Onitsha wholesale buyers.
3. "lifecycleStage": Exactly one of "Emerging", "Peak Aso-Ebi Demand", or "Saturating".
4. "trendingColorways": Array of 3 specific high-converting color combinations (e.g., "Emerald & Champagne Gold").
5. "motifBreakdown": Array of 3-4 concise visual/tactile motif attributes (e.g., "3D floral appliqués", "Metallic gold thread", "Scalloped eyelet border").
6. "merchandisingAdvice": Practical 3-4 sentence Onitsha Main Market merchandising & stocking recommendation (referencing Airport Indian Line / White House Extension, bale sizing, pairing with George/gele, or imitation risk).`;

  const parts: any[] = [];
  if (imagePart) parts.push(imagePart);
  parts.push({ text: promptText });

  const schema = {
    type: Type.OBJECT,
    properties: {
      laceCategory: { type: Type.STRING },
      trendVelocityScore: { type: Type.INTEGER },
      lifecycleStage: { type: Type.STRING },
      trendingColorways: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      motifBreakdown: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      merchandisingAdvice: { type: Type.STRING },
    },
    required: [
      'laceCategory',
      'trendVelocityScore',
      'lifecycleStage',
      'trendingColorways',
      'motifBreakdown',
      'merchandisingAdvice',
    ],
  };

  let response: any;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    });
  } catch (err: any) {
    // Fallback if structured JSON + search tool combination rejects schema on a specific image payload
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction:
          'Respond strictly with a valid JSON object matching keys: laceCategory, trendVelocityScore (integer 0-100), lifecycleStage ("Emerging" | "Peak Aso-Ebi Demand" | "Saturating"), trendingColorways (string[]), motifBreakdown (string[]), merchandisingAdvice (string). No markdown fences.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
  }

  const parsed = parseJsonSafe<Omit<AnalyzeLaceOutput, 'groundingSources'>>(response.text);
  const validStage: AnalyzeLaceOutput['lifecycleStage'] =
    parsed.lifecycleStage === 'Emerging' ||
    parsed.lifecycleStage === 'Peak Aso-Ebi Demand' ||
    parsed.lifecycleStage === 'Saturating'
      ? parsed.lifecycleStage
      : 'Peak Aso-Ebi Demand';

  return {
    laceCategory: parsed.laceCategory || 'Swiss Voile',
    trendVelocityScore: Math.max(0, Math.min(100, Math.round(Number(parsed.trendVelocityScore) || 75))),
    lifecycleStage: validStage,
    trendingColorways: Array.isArray(parsed.trendingColorways) ? parsed.trendingColorways.slice(0, 4) : [],
    motifBreakdown: Array.isArray(parsed.motifBreakdown) ? parsed.motifBreakdown.slice(0, 5) : [],
    merchandisingAdvice: parsed.merchandisingAdvice || '',
    groundingSources: extractGroundingSources(response),
  };
}

export interface SimulateNpiInput {
  laceName: string;
  laceVariety: string;
  landedCostPer5Yards: number;
  targetWholesalePrice: number;
  orderBales: number;
  fxRateNgnPerUsd: number;
  targetLaunchMonth: string;
}

export interface SimulateNpiOutput {
  verdict: 'GO — High Margin' | 'TEST SMALL BATCH' | 'NO-GO — Dead-Stock Risk';
  verdictRationale: string;
  scenarios: NpiScenarioRow[];
  asoEbiDiscountTier: AsoEbiDiscountTier;
  riskFactors: NpiRiskFactor[];
  groundingSources: GroundingSource[];
}

export async function simulateNpiWithGemini(
  input: SimulateNpiInput
): Promise<SimulateNpiOutput> {
  const totalBundles = input.orderBales * 12; // 1 bale = 60 yards = 12 bundles of 5 yards
  const totalCapitalNgn = totalBundles * input.landedCostPer5Yards;
  const maxGrossRevenueNgn = totalBundles * input.targetWholesalePrice;
  const maxGrossProfitNgn = maxGrossRevenueNgn - totalCapitalNgn;

  const prompt = `You are a chief financial & textile merchandising strategist for wholesale lace importers in Onitsha Main Market (Airport Indian Line & White House Extension), Nigeria.
Use Google Search to ground current 2026 Nigeria Naira parallel FX market conditions, festive calendar timing (Easter, Igba Nkwu wedding peaks, Nov-Dec festivities), and Nigerian Aso-Ebi wholesale demand.

Evaluate this New Product Introduction (NPI) batch:
- Lace Name: ${input.laceName}
- Lace Variety: ${input.laceVariety}
- Landed Cost per 5 Yards (1 bundle): ₦${input.landedCostPer5Yards.toLocaleString('en-NG')}
- Target Wholesale Price per 5 Yards: ₦${input.targetWholesalePrice.toLocaleString('en-NG')}
- Order Quantity: ${input.orderBales} bales (${totalBundles} bundles / ${input.orderBales * 60} yards total)
- Total Landed Capital Outlay: ₦${totalCapitalNgn.toLocaleString('en-NG')}
- Max Potential Revenue at Target Price (100% sell-through): ₦${maxGrossRevenueNgn.toLocaleString('en-NG')}
- Max Gross Spread (before markdowns/storage/FX slippage): ₦${maxGrossProfitNgn.toLocaleString('en-NG')}
- Parallel FX Rate Sensitivity Anchor: ₦${input.fxRateNgnPerUsd}/USD
- Target Launch Month: ${input.targetLaunchMonth}

Produce a realistic financial scenario simulation in JSON:
- "verdict": Must be exactly one of "GO — High Margin", "TEST SMALL BATCH", or "NO-GO — Dead-Stock Risk".
- "verdictRationale": Concise 2-3 sentence executive explanation referencing the Naira spread, bale commitment, FX rate, and launch month seasonality.
- "scenarios": Array of exactly 3 objects in order ["Best Case", "Base Case", "Worst Case"], each with:
  - "name": "Best Case" | "Base Case" | "Worst Case"
  - "netProfitNgn": Integer Net Profit in Naira (realistic after sell-through, late-season markdowns, and holding costs; can be negative in Worst Case if spread is thin or seasonal timing is poor)
  - "grossMarginPct": Number (percentage e.g. 24.5)
  - "sellThrough30d": Integer 0-100 (% of bales sold in 30 days)
  - "sellThrough60d": Integer 0-100 (% cumulative sold in 60 days, >= sellThrough30d)
  - "sellThrough90d": Integer 0-100 (% cumulative sold in 90 days, >= sellThrough60d)
- "asoEbiDiscountTier": Object with:
  - "bundleThreshold": e.g. "10+ Bundles (50+ Yards Event Tier)"
  - "recommendedDiscountPct": Integer (e.g. 5 to 10)
  - "discountedPricePer5Yards": Integer price in Naira after discount (should still stay comfortably above landedCostPer5Yards)
  - "plannerPitch": 1-2 sentence pitch for Aso-Ebi event planners
- "riskFactors": Array of 3 risk factor objects covering FX squeeze, local imitation speed, and seasonal timing, each with "title", "severity" ("High" | "Medium" | "Low"), and "detail".`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      verdict: { type: Type.STRING },
      verdictRationale: { type: Type.STRING },
      scenarios: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            netProfitNgn: { type: Type.INTEGER },
            grossMarginPct: { type: Type.NUMBER },
            sellThrough30d: { type: Type.INTEGER },
            sellThrough60d: { type: Type.INTEGER },
            sellThrough90d: { type: Type.INTEGER },
          },
          required: [
            'name',
            'netProfitNgn',
            'grossMarginPct',
            'sellThrough30d',
            'sellThrough60d',
            'sellThrough90d',
          ],
        },
      },
      asoEbiDiscountTier: {
        type: Type.OBJECT,
        properties: {
          bundleThreshold: { type: Type.STRING },
          recommendedDiscountPct: { type: Type.INTEGER },
          discountedPricePer5Yards: { type: Type.INTEGER },
          plannerPitch: { type: Type.STRING },
        },
        required: [
          'bundleThreshold',
          'recommendedDiscountPct',
          'discountedPricePer5Yards',
          'plannerPitch',
        ],
      },
      riskFactors: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            severity: { type: Type.STRING },
            detail: { type: Type.STRING },
          },
          required: ['title', 'severity', 'detail'],
        },
      },
    },
    required: [
      'verdict',
      'verdictRationale',
      'scenarios',
      'asoEbiDiscountTier',
      'riskFactors',
    ],
  };

  let response: any;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    });
  } catch {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction:
          'Respond strictly with a valid JSON object matching keys: verdict, verdictRationale, scenarios, asoEbiDiscountTier, riskFactors. No markdown fences.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
  }

  const parsed = parseJsonSafe<Omit<SimulateNpiOutput, 'groundingSources'>>(response.text);
  const validVerdict: SimulateNpiOutput['verdict'] =
    parsed.verdict === 'GO — High Margin' ||
    parsed.verdict === 'TEST SMALL BATCH' ||
    parsed.verdict === 'NO-GO — Dead-Stock Risk'
      ? parsed.verdict
      : maxGrossProfitNgn > 0
      ? 'TEST SMALL BATCH'
      : 'NO-GO — Dead-Stock Risk';

  return {
    verdict: validVerdict,
    verdictRationale: parsed.verdictRationale,
    scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios.slice(0, 3) : [],
    asoEbiDiscountTier: parsed.asoEbiDiscountTier,
    riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors.slice(0, 4) : [],
    groundingSources: extractGroundingSources(response),
  };
}

export interface GenerateDrapeInput {
  laceName: string;
  laceCategory?: string;
  colorways?: string[];
  garmentStyle: "Women's Iro & Buba / Corset Aso-Ebi Gown" | "Men's Agbada / Senator Style";
  imageSize: '1K' | '2K' | '4K';
  imageDataUrl?: string;
}

export async function generateDrapeWithGemini(
  input: GenerateDrapeInput
): Promise<{ mockupImageUrl: string; styleNotes: string }> {
  const imagePart = await resolveImagePart(input.imageDataUrl);
  const isWomens = input.garmentStyle.includes('Women');

  const garmentDescription = isWomens
    ? `a bespoke Nigerian luxury Women's Corset Aso-Ebi Gown / Modern Iro & Buba silhouette, styled with a neatly tied matching Aso-Oke gele headwrap and subtle gold bridal jewelry, worn by an elegant Nigerian fashion model in an upscale Lagos/Abuja editorial studio`
    : `a regal Nigerian Men's three-piece Agbada & Senator kaftan ensemble with crisp tailored embroidery lines and a matching fila cap, worn by a distinguished Nigerian gentleman in a refined Abuja luxury studio`;

  const colorText =
    input.colorways && input.colorways.length > 0
      ? `preserving the exact color palette (${input.colorways.join(', ')})`
      : '';

  const prompt = `Create a photorealistic, high-fashion commercial lookbook photograph showing the "${input.laceName}" (${input.laceCategory || 'Nigerian luxury lace'}) fabric ${colorText} expertly tailored into ${garmentDescription}. Preserve the exact intricate lace motif, metallic embroidery density, eyelet cutwork, and fabric sheen from the reference lace swatch if provided. Clean warm slate studio backdrop, soft directional editorial lighting, crisp textile texture, zero text overlays or watermarks.`;

  const parts: any[] = [];
  if (imagePart) {
    parts.push(imagePart);
  }
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: '3:4',
        imageSize: input.imageSize || '1K',
      },
    },
  });

  let mockupImageUrl = '';
  let styleNotes = '';
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? 'image/png';
      mockupImageUrl = `data:${mime};base64,${part.inlineData.data}`;
    } else if (part.text) {
      styleNotes += part.text;
    }
  }

  if (!mockupImageUrl) {
    throw new Error('Image model did not return an image asset.');
  }

  return {
    mockupImageUrl,
    styleNotes: styleNotes.trim(),
  };
}

export interface GenerateWhatsappInput {
  laceName: string;
  laceCategory: string;
  marketLine: string;
  wholesalePriceNgn: number;
  asoEbiDiscountPriceNgn?: number;
  garmentStyle: string;
  targetAudience: string;
  colorways: string[];
  urgencyNotes?: string;
}

export async function generateWhatsappCopyWithGemini(
  input: GenerateWhatsappInput
): Promise<string> {
  const prompt = `Write a high-converting, persuasive, street-smart Nigerian wholesale WhatsApp broadcast message for an Onitsha Main Market lace importer (${input.marketLine}) targeting ${input.targetAudience}.

Details to weave in naturally:
- Lace Name & Variety: ${input.laceName} (${input.laceCategory})
- Featured Silhouette: ${input.garmentStyle}
- Available Colorways: ${input.colorways.join(', ') || 'Emerald/Gold, Champagne, Royal Burgundy'}
- Wholesale Price (5 Yards / 1 Bundle): ₦${input.wholesalePriceNgn.toLocaleString('en-NG')}
- Aso-Ebi 10+ Bundles Bulk Rate: ₦${(input.asoEbiDiscountPriceNgn || Math.round(input.wholesalePriceNgn * 0.94)).toLocaleString('en-NG')} per 5 yards
- Extra Market Hook: ${input.urgencyNotes || 'Fresh container arrival; limited bales before December wedding rush'}

Formatting & tone rules:
- Use authentic, respectful Nigerian luxury wholesale trade energy (warm, urgent, credible—mentioning Onitsha Airport Indian Line / White House Extension, zero-itch quality, crisp tailoring sit, and same-day waybill via GUO / Peace Mass / ABC Transport to Lagos, Abuja, Port Harcourt, and Enugu).
- Format cleanly with WhatsApp *bold* asterisks and bullet lines so it is immediately ready to copy and paste into WhatsApp Broadcast lists.
- Keep it tight, punchy, and scannable (under 180 words). Do not include any preamble or commentary outside the WhatsApp message itself.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return (response.text || '').trim();
}

export interface LiveMarketPulseOutput {
  laceName: string;
  laceCategory: string;
  marketLine: string;
  trendVelocityScore: number;
  lifecycleStage: 'Emerging' | 'Peak Aso-Ebi Demand' | 'Saturating';
  trendingColorways: string[];
  recommendedAction: string;
  groundingSources: GroundingSource[];
}

export async function scanLiveMarketPulseWithGemini(
  marketFocus = 'Lagos, Abuja, and South-East Nigeria Igba Nkwu & Owambe weddings'
): Promise<LiveMarketPulseOutput> {
  const prompt = `Use Google Search to check the hottest, fastest-moving Nigerian Aso-Ebi lace trends right now (${new Date().toISOString().slice(0, 10)}) across ${marketFocus} that wholesale importers at Onitsha Main Market (Airport Indian Line & White House Extension) can lock in before competitors.

Return a single JSON object identifying the strongest emerging or peak-demand lace opportunity:
- "laceName": Specific marketable lace name (e.g., "3D Organza Beaded Tulle Lace" or "Champagne Metallic Swiss Voile")
- "laceCategory": One of "Swiss Voile", "Cord Lace", "Guipure", "French Beaded/Sequined", or "Dry Lace"
- "marketLine": Either "Airport Indian Line" or "White House Extension"
- "trendVelocityScore": Realistic integer 0-100 reflecting current social/bridal demand momentum
- "lifecycleStage": "Emerging" | "Peak Aso-Ebi Demand" | "Saturating"
- "trendingColorways": Array of 3 specific trending Nigerian Aso-Ebi color combinations
- "recommendedAction": Concise 1-2 sentence first-mover tactical advice for an Onitsha wholesaler (bale ordering or Lagos/Abuja boutique lock-in).`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      laceName: { type: Type.STRING },
      laceCategory: { type: Type.STRING },
      marketLine: { type: Type.STRING },
      trendVelocityScore: { type: Type.INTEGER },
      lifecycleStage: { type: Type.STRING },
      trendingColorways: { type: Type.ARRAY, items: { type: Type.STRING } },
      recommendedAction: { type: Type.STRING },
    },
    required: [
      'laceName',
      'laceCategory',
      'marketLine',
      'trendVelocityScore',
      'lifecycleStage',
      'trendingColorways',
      'recommendedAction',
    ],
  };

  let response: any;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
  } catch {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction:
          'Respond strictly with a valid JSON object matching keys: laceName, laceCategory, marketLine, trendVelocityScore, lifecycleStage, trendingColorways, recommendedAction. No markdown fences.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
  }

  const parsed = parseJsonSafe<Omit<LiveMarketPulseOutput, 'groundingSources'>>(
    response.text
  );
  const validStage: LiveMarketPulseOutput['lifecycleStage'] =
    parsed.lifecycleStage === 'Emerging' ||
    parsed.lifecycleStage === 'Peak Aso-Ebi Demand' ||
    parsed.lifecycleStage === 'Saturating'
      ? parsed.lifecycleStage
      : 'Peak Aso-Ebi Demand';

  return {
    laceName: parsed.laceName || '3D Floral Beaded Swiss Voile',
    laceCategory: parsed.laceCategory || 'Swiss Voile',
    marketLine: parsed.marketLine || 'Airport Indian Line',
    trendVelocityScore: Math.max(
      0,
      Math.min(100, Math.round(Number(parsed.trendVelocityScore) || 86))
    ),
    lifecycleStage: validStage,
    trendingColorways: Array.isArray(parsed.trendingColorways)
      ? parsed.trendingColorways.slice(0, 3)
      : [],
    recommendedAction:
      parsed.recommendedAction ||
      'Lock 8–12 bales on Airport Indian Line and push WhatsApp Aso-Ebi pre-orders to Lagos planners.',
    groundingSources: extractGroundingSources(response),
  };
}

