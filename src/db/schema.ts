import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export interface GroundingSource {
  title: string;
  uri: string;
}

export const laceAnalyses = pgTable('lace_analyses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  laceName: text('lace_name').notNull(),
  marketLine: text('market_line').notNull(),
  imageUrl: text('image_url'),
  marketNotes: text('market_notes'),
  laceCategory: text('lace_category').notNull(),
  trendVelocityScore: integer('trend_velocity_score').notNull(),
  lifecycleStage: text('lifecycle_stage').notNull(),
  trendingColorways: jsonb('trending_colorways').$type<string[]>().notNull(),
  motifBreakdown: jsonb('motif_breakdown').$type<string[]>().notNull(),
  merchandisingAdvice: text('merchandising_advice').notNull(),
  groundingSources: jsonb('grounding_sources').$type<GroundingSource[]>().default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

export interface NpiScenarioRow {
  name: string;
  netProfitNgn: number;
  grossMarginPct: number;
  sellThrough30d: number;
  sellThrough60d: number;
  sellThrough90d: number;
}

export interface AsoEbiDiscountTier {
  bundleThreshold: string;
  recommendedDiscountPct: number;
  discountedPricePer5Yards: number;
  plannerPitch: string;
}

export interface NpiRiskFactor {
  title: string;
  severity: 'High' | 'Medium' | 'Low';
  detail: string;
}

export const npiSimulations = pgTable('npi_simulations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  laceName: text('lace_name').notNull(),
  laceVariety: text('lace_variety').notNull(),
  landedCostPer5Yards: integer('landed_cost_per_5_yards').notNull(),
  targetWholesalePrice: integer('target_wholesale_price').notNull(),
  orderBales: integer('order_bales').notNull(),
  fxRateNgnPerUsd: integer('fx_rate_ngn_per_usd').notNull(),
  targetLaunchMonth: text('target_launch_month').notNull(),
  verdict: text('verdict').notNull(),
  verdictRationale: text('verdict_rationale').notNull(),
  scenarios: jsonb('scenarios').$type<NpiScenarioRow[]>().notNull(),
  asoEbiDiscountTier: jsonb('aso_ebi_discount_tier').$type<AsoEbiDiscountTier>().notNull(),
  riskFactors: jsonb('risk_factors').$type<NpiRiskFactor[]>().notNull(),
  groundingSources: jsonb('grounding_sources').$type<GroundingSource[]>().default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

export const drapePitchAssets = pgTable('drape_pitch_assets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  laceName: text('lace_name').notNull(),
  garmentStyle: text('garment_style').notNull(),
  imageSize: text('image_size').notNull(),
  mockupImageUrl: text('mockup_image_url').notNull(),
  whatsappCopy: text('whatsapp_copy').notNull(),
  targetAudience: text('target_audience').notNull(),
  isPinned: boolean('is_pinned').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const trendAlerts = pgTable('trend_alerts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  alertKey: text('alert_key').notNull().unique(),
  laceName: text('lace_name').notNull(),
  laceCategory: text('lace_category').notNull(),
  marketLine: text('market_line').notNull(),
  trendVelocityScore: integer('trend_velocity_score').notNull(),
  lifecycleStage: text('lifecycle_stage').notNull(),
  recommendedAction: text('recommended_action').notNull(),
  trendingColorways: jsonb('trending_colorways').$type<string[]>().notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  laceAnalyses: many(laceAnalyses),
  npiSimulations: many(npiSimulations),
  drapePitchAssets: many(drapePitchAssets),
  trendAlerts: many(trendAlerts),
}));

export const laceAnalysesRelations = relations(laceAnalyses, ({ one }) => ({
  owner: one(users, {
    fields: [laceAnalyses.userId],
    references: [users.id],
  }),
}));

export const npiSimulationsRelations = relations(npiSimulations, ({ one }) => ({
  owner: one(users, {
    fields: [npiSimulations.userId],
    references: [users.id],
  }),
}));

export const drapePitchAssetsRelations = relations(drapePitchAssets, ({ one }) => ({
  owner: one(users, {
    fields: [drapePitchAssets.userId],
    references: [users.id],
  }),
}));

export const trendAlertsRelations = relations(trendAlerts, ({ one }) => ({
  owner: one(users, {
    fields: [trendAlerts.userId],
    references: [users.id],
  }),
}));
