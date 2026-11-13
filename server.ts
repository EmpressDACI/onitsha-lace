import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
  getOrCreateUser,
  getUserWorkspaceData,
  markAllTrendAlertsRead,
  markTrendAlertRead,
  saveDrapePitch,
  saveLaceAnalysis,
  saveNpiSimulation,
  saveTrendAlert,
} from './src/db/users.ts';
import { optionalAuth, requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  analyzeLaceWithGemini,
  generateDrapeWithGemini,
  generateWhatsappCopyWithGemini,
  scanLiveMarketPulseWithGemini,
  simulateNpiWithGemini,
} from './src/services/geminiService.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

export interface ServerTrendAlert {
  alertKey: string;
  laceName: string;
  laceCategory: string;
  marketLine: string;
  trendVelocityScore: number;
  lifecycleStage: string;
  recommendedAction: string;
  trendingColorways: string[];
  isRead: boolean;
  createdAt: string;
}

let serverAlertThreshold = 80;

const serverAlerts: ServerTrendAlert[] = [
  {
    alertKey: 'seed-emerald-swiss-voile',
    laceName: 'Royal Emerald Metallic Swiss Voile',
    laceCategory: 'Swiss Voile',
    marketLine: 'Airport Indian Line · Block C',
    trendVelocityScore: 89,
    lifecycleStage: 'Peak Aso-Ebi Demand',
    recommendedAction:
      'Reserve 12-bundle bales on Airport Indian Line before mid-November and lock in 10+ bundle Lagos/Enugu Aso-Ebi planners at ₦78,960/5 yds.',
    trendingColorways: [
      'Deep Emerald & Champagne Gold',
      'Forest Green & Antique Bronze',
      'Teal & Warm Ivory',
    ],
    isRead: false,
    createdAt: '2026-11-12T10:15:00.000Z',
  },
  {
    alertKey: 'seed-champagne-french-cord',
    laceName: 'Champagne Pearl Beaded French Cord',
    laceCategory: 'French Beaded/Sequined',
    marketLine: 'White House Extension · Zone 2',
    trendVelocityScore: 84,
    lifecycleStage: 'Emerging',
    recommendedAction:
      'Stock 5–8 bale lots for Abuja & Lekki bridal train orders before local imitation hits Main Market outer rows.',
    trendingColorways: [
      'Champagne Ivory & Rose Gold',
      'Warm Cream & Antique Gold',
    ],
    isRead: false,
    createdAt: '2026-11-11T15:40:00.000Z',
  },
];

const wss = new WebSocketServer({ noServer: true });

function broadcastWsEvent(type: string, payload: unknown) {
  const message = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function recordAndBroadcastAlert(alert: ServerTrendAlert) {
  const exists = serverAlerts.some((a) => a.alertKey === alert.alertKey);
  if (!exists) {
    serverAlerts.unshift(alert);
    if (serverAlerts.length > 30) {
      serverAlerts.length = 30;
    }
  }
  broadcastWsEvent('trend:alert', alert);
}

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({
      type: 'alerts:sync',
      payload: {
        threshold: serverAlertThreshold,
        alerts: serverAlerts,
      },
    })
  );

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg?.type === 'threshold:update') {
        const next = Number(msg.threshold);
        if (Number.isFinite(next) && next >= 50 && next <= 99) {
          serverAlertThreshold = Math.round(next);
          broadcastWsEvent('threshold:updated', { threshold: serverAlertThreshold });
        }
      } else if (msg?.type === 'alert:ack' && typeof msg.alertKey === 'string') {
        const target = serverAlerts.find((a) => a.alertKey === msg.alertKey);
        if (target) target.isRead = true;
        broadcastWsEvent('alert:acked', { alertKey: msg.alertKey });
      } else if (msg?.type === 'alert:ack_all') {
        for (const a of serverAlerts) a.isRead = true;
        broadcastWsEvent('alerts:acked_all', {});
      }
    } catch {
      // Ignore malformed client frames
    }
  });
});

// Authenticated Cloud SQL workspace endpoints
app.get('/api/workspace', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || `${uid}@lacepulse.local`;
    const displayName = req.user!.name;
    await getOrCreateUser(uid, email, displayName);
    const workspace = await getUserWorkspaceData(uid);
    res.json(workspace);
  } catch (error: any) {
    console.error('Error loading workspace:', error);
    res.status(500).json({ error: error.message || 'Failed to load workspace.' });
  }
});

app.post('/api/workspace/analyses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || `${req.user!.uid}@lacepulse.local`,
      req.user!.name
    );
    const saved = await saveLaceAnalysis(user.id, req.body);
    res.json(saved);
  } catch (error: any) {
    console.error('Error saving lace analysis:', error);
    res.status(500).json({ error: error.message || 'Failed to save lace analysis.' });
  }
});

app.post('/api/workspace/simulations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || `${req.user!.uid}@lacepulse.local`,
      req.user!.name
    );
    const saved = await saveNpiSimulation(user.id, req.body);
    res.json(saved);
  } catch (error: any) {
    console.error('Error saving simulation:', error);
    res.status(500).json({ error: error.message || 'Failed to save NPI simulation.' });
  }
});

app.post('/api/workspace/pitches', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || `${req.user!.uid}@lacepulse.local`,
      req.user!.name
    );
    const saved = await saveDrapePitch(user.id, req.body);
    res.json(saved);
  } catch (error: any) {
    console.error('Error saving pitch:', error);
    res.status(500).json({ error: error.message || 'Failed to save pitch.' });
  }
});

app.post('/api/workspace/alerts/ack', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { alertKey } = req.body ?? {};
    if (typeof alertKey !== 'string' || !alertKey) {
      return res.status(400).json({ error: 'alertKey is required.' });
    }
    await markTrendAlertRead(req.user!.uid, alertKey);
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: error.message || 'Failed to acknowledge alert.' });
  }
});

app.post('/api/workspace/alerts/ack-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await markAllTrendAlertsRead(req.user!.uid);
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error acknowledging all alerts:', error);
    res.status(500).json({ error: error.message || 'Failed to acknowledge alerts.' });
  }
});

// Gemini AI endpoints (automatically persist to Cloud SQL when authenticated)
app.post('/api/ai/analyze-lace', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { laceName, marketLine, marketNotes, imageDataUrl } = req.body ?? {};
    if (!imageDataUrl && !marketNotes && !laceName) {
      return res
        .status(400)
        .json({ error: 'Please provide a lace fabric image or market notes to analyze.' });
    }

    const result = await analyzeLaceWithGemini({
      laceName: laceName || 'Uploaded Lace Swatch',
      marketLine: marketLine || 'Airport Indian Line',
      marketNotes: marketNotes || '',
      imageDataUrl,
    });

    let savedRecord = null;
    let triggeredAlert: ServerTrendAlert | null = null;
    const resolvedName = laceName || 'Uploaded Lace Swatch';
    const resolvedLine = marketLine || 'Airport Indian Line';

    if (result.trendVelocityScore >= serverAlertThreshold) {
      triggeredAlert = {
        alertKey: `alert-${crypto.randomUUID()}`,
        laceName: resolvedName,
        laceCategory: result.laceCategory,
        marketLine: resolvedLine,
        trendVelocityScore: result.trendVelocityScore,
        lifecycleStage: result.lifecycleStage,
        recommendedAction: result.merchandisingAdvice,
        trendingColorways: result.trendingColorways,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      recordAndBroadcastAlert(triggeredAlert);
    }

    if (req.user) {
      try {
        const user = await getOrCreateUser(
          req.user.uid,
          req.user.email || `${req.user.uid}@lacepulse.local`,
          req.user.name
        );
        savedRecord = await saveLaceAnalysis(user.id, {
          laceName: resolvedName,
          marketLine: resolvedLine,
          imageUrl: imageDataUrl && imageDataUrl.length < 350000 ? imageDataUrl : null,
          marketNotes: marketNotes || '',
          ...result,
        });
        if (triggeredAlert) {
          await saveTrendAlert(user.id, triggeredAlert);
        }
      } catch (dbErr) {
        console.error('Non-fatal DB save warning for analysis:', dbErr);
      }
    }

    res.json({
      ...result,
      savedId: savedRecord?.id ?? null,
      triggeredAlert,
    });
  } catch (error: any) {
    console.error('Lace analysis failed:', error);
    res.status(500).json({
      error: error?.message || 'Gemini multimodal fabric analysis failed.',
    });
  }
});

app.post('/api/ai/scan-market-pulse', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { marketFocus } = req.body ?? {};
    const pulse = await scanLiveMarketPulseWithGemini(marketFocus);

    let triggeredAlert: ServerTrendAlert | null = null;
    if (pulse.trendVelocityScore >= serverAlertThreshold) {
      triggeredAlert = {
        alertKey: `pulse-${crypto.randomUUID()}`,
        laceName: pulse.laceName,
        laceCategory: pulse.laceCategory,
        marketLine: pulse.marketLine,
        trendVelocityScore: pulse.trendVelocityScore,
        lifecycleStage: pulse.lifecycleStage,
        recommendedAction: pulse.recommendedAction,
        trendingColorways: pulse.trendingColorways,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      recordAndBroadcastAlert(triggeredAlert);

      if (req.user) {
        try {
          const user = await getOrCreateUser(
            req.user.uid,
            req.user.email || `${req.user.uid}@lacepulse.local`,
            req.user.name
          );
          await saveTrendAlert(user.id, triggeredAlert);
        } catch (dbErr) {
          console.error('Non-fatal DB save warning for market pulse alert:', dbErr);
        }
      }
    }

    res.json({
      pulse,
      triggeredAlert,
      threshold: serverAlertThreshold,
    });
  } catch (error: any) {
    console.error('Live market pulse scan failed:', error);
    res.status(500).json({
      error: error?.message || 'Live market pulse scan failed.',
    });
  }
});

app.post('/api/ai/simulate-npi', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      laceName,
      laceVariety,
      landedCostPer5Yards,
      targetWholesalePrice,
      orderBales,
      fxRateNgnPerUsd,
      targetLaunchMonth,
    } = req.body ?? {};

    if (!laceName || !landedCostPer5Yards || !targetWholesalePrice || !orderBales) {
      return res.status(400).json({ error: 'Missing required NPI simulation parameters.' });
    }

    const result = await simulateNpiWithGemini({
      laceName,
      laceVariety: laceVariety || 'Swiss Voile',
      landedCostPer5Yards: Number(landedCostPer5Yards),
      targetWholesalePrice: Number(targetWholesalePrice),
      orderBales: Number(orderBales),
      fxRateNgnPerUsd: Number(fxRateNgnPerUsd || 1680),
      targetLaunchMonth: targetLaunchMonth || 'December',
    });

    let savedRecord = null;
    if (req.user) {
      try {
        const user = await getOrCreateUser(
          req.user.uid,
          req.user.email || `${req.user.uid}@lacepulse.local`,
          req.user.name
        );
        savedRecord = await saveNpiSimulation(user.id, {
          laceName,
          laceVariety: laceVariety || 'Swiss Voile',
          landedCostPer5Yards: Number(landedCostPer5Yards),
          targetWholesalePrice: Number(targetWholesalePrice),
          orderBales: Number(orderBales),
          fxRateNgnPerUsd: Number(fxRateNgnPerUsd || 1680),
          targetLaunchMonth: targetLaunchMonth || 'December',
          ...result,
        });
      } catch (dbErr) {
        console.error('Non-fatal DB save warning for NPI simulation:', dbErr);
      }
    }

    res.json({ ...result, savedId: savedRecord?.id ?? null });
  } catch (error: any) {
    console.error('NPI simulation failed:', error);
    res.status(500).json({
      error: error?.message || 'Gemini NPI financial simulation failed.',
    });
  }
});

app.post('/api/ai/generate-drape', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { laceName, laceCategory, colorways, garmentStyle, imageSize, imageDataUrl } =
      req.body ?? {};
    const validSize: '1K' | '2K' | '4K' =
      imageSize === '2K' || imageSize === '4K' ? imageSize : '1K';

    const result = await generateDrapeWithGemini({
      laceName: laceName || 'Royal Emerald Swiss Voile',
      laceCategory,
      colorways,
      garmentStyle: garmentStyle || "Women's Iro & Buba / Corset Aso-Ebi Gown",
      imageSize: validSize,
      imageDataUrl,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Virtual drape generation failed:', error);
    const msg = error?.message || 'Virtual drape image generation failed.';
    res.status(error?.status === 403 || error?.status === 429 ? error.status : 500).json({
      error: msg,
    });
  }
});

app.post('/api/ai/generate-whatsapp', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      laceName,
      laceCategory,
      marketLine,
      wholesalePriceNgn,
      asoEbiDiscountPriceNgn,
      garmentStyle,
      targetAudience,
      colorways,
      urgencyNotes,
      mockupImageUrl,
      imageSize,
    } = req.body ?? {};

    const copy = await generateWhatsappCopyWithGemini({
      laceName: laceName || 'Royal Emerald Swiss Voile',
      laceCategory: laceCategory || 'Swiss Voile',
      marketLine: marketLine || 'Airport Indian Line',
      wholesalePriceNgn: Number(wholesalePriceNgn || 84000),
      asoEbiDiscountPriceNgn: asoEbiDiscountPriceNgn ? Number(asoEbiDiscountPriceNgn) : undefined,
      garmentStyle: garmentStyle || "Women's Iro & Buba / Corset Aso-Ebi Gown",
      targetAudience: targetAudience || 'Lagos & Abuja Boutique Owners / Aso-Ebi Planners',
      colorways: Array.isArray(colorways) ? colorways : [],
      urgencyNotes,
    });

    let savedRecord = null;
    if (req.user && mockupImageUrl && mockupImageUrl.length < 400000) {
      try {
        const user = await getOrCreateUser(
          req.user.uid,
          req.user.email || `${req.user.uid}@lacepulse.local`,
          req.user.name
        );
        savedRecord = await saveDrapePitch(user.id, {
          laceName: laceName || 'Royal Emerald Swiss Voile',
          garmentStyle: garmentStyle || "Women's Iro & Buba / Corset Aso-Ebi Gown",
          imageSize: imageSize || '1K',
          mockupImageUrl,
          whatsappCopy: copy,
          targetAudience: targetAudience || 'Lagos & Abuja Boutique Owners / Aso-Ebi Planners',
        });
      } catch (dbErr) {
        console.error('Non-fatal DB save warning for pitch:', dbErr);
      }
    }

    res.json({ whatsappCopy: copy, savedId: savedRecord?.id ?? null });
  } catch (error: any) {
    console.error('WhatsApp pitch generation failed:', error);
    res.status(500).json({
      error: error?.message || 'WhatsApp broadcast copy generation failed.',
    });
  }
});

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url || '';
    if (reqUrl.startsWith('/ws/alerts')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Onitsha LacePulse AI server & WebSocket hub running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
