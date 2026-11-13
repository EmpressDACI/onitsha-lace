import { useCallback, useEffect, useRef, useState } from 'react';

export interface TrendAlertItem {
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

export type WsConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

function playAlertChime() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [659.25, 880]; // E5 -> A5 crisp chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);
      gain.gain.setValueAtTime(0.06, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.26);
    });
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export function useTrendAlerts(getToken: () => Promise<string | null>) {
  const [alerts, setAlerts] = useState<TrendAlertItem[]>([]);
  const [threshold, setThreshold] = useState<number>(80);
  const [connectionStatus, setConnectionStatus] =
    useState<WsConnectionStatus>('connecting');
  const [latestToast, setLatestToast] = useState<TrendAlertItem | null>(null);
  const [isScanningPulse, setIsScanningPulse] = useState(false);
  const [pulseStatusNote, setPulseStatusNote] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied'
  );

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  useEffect(() => {
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/alerts`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (isUnmounted) return;
        reconnectAttemptRef.current = 0;
        setConnectionStatus('connected');
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'alerts:sync') {
            const syncThreshold = Number(msg.payload?.threshold);
            if (Number.isFinite(syncThreshold)) {
              setThreshold(syncThreshold);
            }
            const incoming: TrendAlertItem[] = Array.isArray(msg.payload?.alerts)
              ? msg.payload.alerts
              : [];
            setAlerts((prev) => {
              const byKey = new Map<string, TrendAlertItem>();
              for (const item of incoming) byKey.set(item.alertKey, item);
              for (const existing of prev) {
                if (!byKey.has(existing.alertKey)) {
                  byKey.set(existing.alertKey, existing);
                }
              }
              return Array.from(byKey.values()).sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
            });
          } else if (msg.type === 'trend:alert' && msg.payload) {
            const incomingAlert = msg.payload as TrendAlertItem;
            let isBrandNew = false;

            setAlerts((prev) => {
              if (prev.some((a) => a.alertKey === incomingAlert.alertKey)) {
                return prev;
              }
              isBrandNew = true;
              return [incomingAlert, ...prev];
            });

            // Always show toast for incoming real-time broadcast if not already in state
            setAlerts((current) => {
              const found = current.find(
                (a) => a.alertKey === incomingAlert.alertKey
              );
              if (found && isBrandNew) {
                setLatestToast(incomingAlert);
              }
              return current;
            });

            setLatestToast(incomingAlert);
            if (soundEnabledRef.current) {
              playAlertChime();
            }
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              new Notification(
                `High-Demand Aso-Ebi (${incomingAlert.trendVelocityScore}/100): ${incomingAlert.laceName}`,
                {
                  body: `${incomingAlert.marketLine} · ${incomingAlert.recommendedAction}`,
                }
              );
            }
          } else if (msg.type === 'threshold:updated') {
            const next = Number(msg.payload?.threshold);
            if (Number.isFinite(next)) setThreshold(next);
          } else if (msg.type === 'alert:acked') {
            const key = msg.payload?.alertKey;
            if (key) {
              setAlerts((prev) =>
                prev.map((a) =>
                  a.alertKey === key ? { ...a, isRead: true } : a
                )
              );
            }
          } else if (msg.type === 'alerts:acked_all') {
            setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      socket.onclose = () => {
        if (isUnmounted) return;
        setConnectionStatus('reconnecting');
        const attempt = reconnectAttemptRef.current;
        reconnectAttemptRef.current = Math.min(attempt + 1, 5);
        const delayMs = Math.min(15000, 1500 * Math.pow(2, attempt));
        reconnectTimerRef.current = setTimeout(connect, delayMs);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  const mergePersistedAlerts = useCallback((dbAlerts: TrendAlertItem[]) => {
    if (!Array.isArray(dbAlerts) || dbAlerts.length === 0) return;
    setAlerts((prev) => {
      const byKey = new Map<string, TrendAlertItem>();
      for (const a of prev) byKey.set(a.alertKey, a);
      for (const dbItem of dbAlerts) {
        if (!byKey.has(dbItem.alertKey)) {
          byKey.set(dbItem.alertKey, dbItem);
        } else if (dbItem.isRead) {
          byKey.set(dbItem.alertKey, {
            ...byKey.get(dbItem.alertKey)!,
            isRead: true,
          });
        }
      }
      return Array.from(byKey.values()).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, []);

  const updateThreshold = useCallback((nextThreshold: number) => {
    setThreshold(nextThreshold);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'threshold:update', threshold: nextThreshold })
      );
    }
  }, []);

  const acknowledgeAlert = useCallback(
    async (alertKey: string) => {
      setAlerts((prev) =>
        prev.map((a) => (a.alertKey === alertKey ? { ...a, isRead: true } : a))
      );
      setLatestToast((prev) => (prev?.alertKey === alertKey ? null : prev));

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'alert:ack', alertKey }));
      }

      const token = await getToken();
      if (token) {
        try {
          await fetch('/api/workspace/alerts/ack', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ alertKey }),
          });
        } catch {
          // Non-fatal
        }
      }
    },
    [getToken]
  );

  const acknowledgeAllAlerts = useCallback(async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    setLatestToast(null);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'alert:ack_all' }));
    }

    const token = await getToken();
    if (token) {
      try {
        await fetch('/api/workspace/alerts/ack-all', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Non-fatal
      }
    }
  }, [getToken]);

  const requestDesktopPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setDesktopPermission(result);
    } catch {
      // Ignore permission rejection
    }
  }, []);

  const runLivePulseScan = useCallback(
    async (marketFocus?: string) => {
      setIsScanningPulse(true);
      setPulseStatusNote(null);
      try {
        const token = await getToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch('/api/ai/scan-market-pulse', {
          method: 'POST',
          headers,
          body: JSON.stringify({ marketFocus }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Live market pulse scan failed.');
        }

        if (data.triggeredAlert) {
          setPulseStatusNote(
            `High-demand surge detected: ${data.pulse.laceName} (${data.pulse.trendVelocityScore}/100)`
          );
        } else {
          setPulseStatusNote(
            `Scanned live pulse: ${data.pulse.laceName} scored ${data.pulse.trendVelocityScore}/100 (below ${data.threshold} threshold)`
          );
        }
      } catch (err: any) {
        setPulseStatusNote(err?.message || 'Unable to complete live pulse scan.');
      } finally {
        setIsScanningPulse(false);
      }
    },
    [getToken]
  );

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return {
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
    dismissToast: () => setLatestToast(null),
    mergePersistedAlerts,
    updateThreshold,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    requestDesktopPermission,
    runLivePulseScan,
  };
}
