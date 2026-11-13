import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  drapePitchAssets,
  laceAnalyses,
  npiSimulations,
  trendAlerts,
  users,
  type AsoEbiDiscountTier,
  type GroundingSource,
  type NpiRiskFactor,
  type NpiScenarioRow,
} from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName ?? null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(displayName ? { displayName } : {}),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to upsert user:', error);
    throw new Error('Database user sync failed. Please try again later.', { cause: error });
  }
}

export async function getUserWorkspaceData(uid: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!user) {
      return { analyses: [], simulations: [], pitches: [], alerts: [] };
    }

    const [analyses, simulations, pitches, alerts] = await Promise.all([
      db
        .select()
        .from(laceAnalyses)
        .where(eq(laceAnalyses.userId, user.id))
        .orderBy(desc(laceAnalyses.createdAt))
        .limit(20),
      db
        .select()
        .from(npiSimulations)
        .where(eq(npiSimulations.userId, user.id))
        .orderBy(desc(npiSimulations.createdAt))
        .limit(20),
      db
        .select()
        .from(drapePitchAssets)
        .where(eq(drapePitchAssets.userId, user.id))
        .orderBy(desc(drapePitchAssets.createdAt))
        .limit(20),
      db
        .select()
        .from(trendAlerts)
        .where(eq(trendAlerts.userId, user.id))
        .orderBy(desc(trendAlerts.createdAt))
        .limit(30),
    ]);

    return { analyses, simulations, pitches, alerts };
  } catch (error) {
    console.error('Failed to fetch workspace data:', error);
    throw new Error('Unable to load saved workspace records.', { cause: error });
  }
}

export async function saveLaceAnalysis(
  userId: number,
  input: {
    laceName: string;
    marketLine: string;
    imageUrl?: string | null;
    marketNotes?: string | null;
    laceCategory: string;
    trendVelocityScore: number;
    lifecycleStage: string;
    trendingColorways: string[];
    motifBreakdown: string[];
    merchandisingAdvice: string;
    groundingSources?: GroundingSource[];
  }
) {
  try {
    const [inserted] = await db
      .insert(laceAnalyses)
      .values({
        userId,
        laceName: input.laceName,
        marketLine: input.marketLine,
        imageUrl: input.imageUrl ?? null,
        marketNotes: input.marketNotes ?? null,
        laceCategory: input.laceCategory,
        trendVelocityScore: input.trendVelocityScore,
        lifecycleStage: input.lifecycleStage,
        trendingColorways: input.trendingColorways,
        motifBreakdown: input.motifBreakdown,
        merchandisingAdvice: input.merchandisingAdvice,
        groundingSources: input.groundingSources ?? [],
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Failed to save lace analysis:', error);
    throw new Error('Unable to save fabric analysis.', { cause: error });
  }
}

export async function saveNpiSimulation(
  userId: number,
  input: {
    laceName: string;
    laceVariety: string;
    landedCostPer5Yards: number;
    targetWholesalePrice: number;
    orderBales: number;
    fxRateNgnPerUsd: number;
    targetLaunchMonth: string;
    verdict: string;
    verdictRationale: string;
    scenarios: NpiScenarioRow[];
    asoEbiDiscountTier: AsoEbiDiscountTier;
    riskFactors: NpiRiskFactor[];
    groundingSources?: GroundingSource[];
  }
) {
  try {
    const [inserted] = await db
      .insert(npiSimulations)
      .values({
        userId,
        laceName: input.laceName,
        laceVariety: input.laceVariety,
        landedCostPer5Yards: input.landedCostPer5Yards,
        targetWholesalePrice: input.targetWholesalePrice,
        orderBales: input.orderBales,
        fxRateNgnPerUsd: input.fxRateNgnPerUsd,
        targetLaunchMonth: input.targetLaunchMonth,
        verdict: input.verdict,
        verdictRationale: input.verdictRationale,
        scenarios: input.scenarios,
        asoEbiDiscountTier: input.asoEbiDiscountTier,
        riskFactors: input.riskFactors,
        groundingSources: input.groundingSources ?? [],
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Failed to save NPI simulation:', error);
    throw new Error('Unable to save NPI simulation.', { cause: error });
  }
}

export async function saveDrapePitch(
  userId: number,
  input: {
    laceName: string;
    garmentStyle: string;
    imageSize: string;
    mockupImageUrl: string;
    whatsappCopy: string;
    targetAudience: string;
  }
) {
  try {
    const [inserted] = await db
      .insert(drapePitchAssets)
      .values({
        userId,
        laceName: input.laceName,
        garmentStyle: input.garmentStyle,
        imageSize: input.imageSize,
        mockupImageUrl: input.mockupImageUrl,
        whatsappCopy: input.whatsappCopy,
        targetAudience: input.targetAudience,
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Failed to save drape pitch asset:', error);
    throw new Error('Unable to save virtual drape pitch.', { cause: error });
  }
}

export async function saveTrendAlert(
  userId: number,
  input: {
    alertKey: string;
    laceName: string;
    laceCategory: string;
    marketLine: string;
    trendVelocityScore: number;
    lifecycleStage: string;
    recommendedAction: string;
    trendingColorways: string[];
  }
) {
  try {
    const [inserted] = await db
      .insert(trendAlerts)
      .values({
        userId,
        alertKey: input.alertKey,
        laceName: input.laceName,
        laceCategory: input.laceCategory,
        marketLine: input.marketLine,
        trendVelocityScore: input.trendVelocityScore,
        lifecycleStage: input.lifecycleStage,
        recommendedAction: input.recommendedAction,
        trendingColorways: input.trendingColorways,
        isRead: false,
      })
      .onConflictDoNothing({ target: trendAlerts.alertKey })
      .returning();
    return inserted ?? null;
  } catch (error) {
    console.error('Failed to save trend alert:', error);
    throw new Error('Unable to persist trend alert.', { cause: error });
  }
}

export async function markTrendAlertRead(uid: string, alertKey: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!user) return;
    await db
      .update(trendAlerts)
      .set({ isRead: true })
      .where(and(eq(trendAlerts.userId, user.id), eq(trendAlerts.alertKey, alertKey)));
  } catch (error) {
    console.error('Failed to mark alert as read:', error);
    throw new Error('Unable to update alert state.', { cause: error });
  }
}

export async function markAllTrendAlertsRead(uid: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!user) return;
    await db
      .update(trendAlerts)
      .set({ isRead: true })
      .where(eq(trendAlerts.userId, user.id));
  } catch (error) {
    console.error('Failed to mark all alerts as read:', error);
    throw new Error('Unable to update alert state.', { cause: error });
  }
}
