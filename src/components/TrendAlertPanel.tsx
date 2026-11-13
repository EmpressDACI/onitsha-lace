import React, { useState } from 'react';
import {
  ArrowRight,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Loader2,
  Radar,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  TrendAlertItem,
  WsConnectionStatus,
} from '../hooks/useTrendAlerts';

interface TrendAlertPanelProps {
  alerts: TrendAlertItem[];
  unreadCount: number;
  threshold: number;
  connectionStatus: WsConnectionStatus;
  latestToast: TrendAlertItem | null;
  isScanningPulse: boolean;
  pulseStatusNote: string | null;
  soundEnabled: boolean;
  desktopPermission: NotificationPermission;
  onToggleSound: () => void;
  onUpdateThreshold: (value: number) => void;
  onAcknowledgeAlert: (alertKey: string) => void;
  onAcknowledgeAll: () => void;
  onRequestDesktopPermission: () => void;
  onRunLivePulseScan: () => void;
  onDismissToast: () => void;
  onSimulateAlertInNpi: (alert: TrendAlertItem) => void;
  onPitchAlertInStudio: (alert: TrendAlertItem) => void;
}

const THRESHOLD_OPTIONS = [70, 75, 80, 85, 90];

export const TrendAlertPanel: React.FC<TrendAlertPanelProps> = ({
  alerts,
  unreadCount,
  threshold,
  connectionStatus,
  latestToast,
  isScanningPulse,
  pulseStatusNote,
  soundEnabled,
  desktopPermission,
  onToggleSound,
  onUpdateThreshold,
  onAcknowledgeAlert,
  onAcknowledgeAll,
  onRequestDesktopPermission,
  onRunLivePulseScan,
  onDismissToast,
  onSimulateAlertInNpi,
  onPitchAlertInStudio,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const connectionLabel =
    connectionStatus === 'connected'
      ? 'Live WebSocket Active'
      : connectionStatus === 'reconnecting'
      ? 'Reconnecting Alert Stream...'
      : 'Connecting Alert Stream...';

  return (
    <>
      {/* Real-Time Aso-Ebi Alert Workspace Toolbar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Real WebSocket status + Threshold */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="inline-flex items-center gap-2 font-medium text-slate-700">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-600'
                    : connectionStatus === 'reconnecting'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
              <span>{connectionLabel}</span>
            </div>

            <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
              |
            </span>

            <label className="inline-flex items-center gap-2 text-slate-600">
              <span>Alert Threshold:</span>
              <select
                aria-label="High-Demand Velocity Alert Threshold"
                value={threshold}
                onChange={(e) => onUpdateThreshold(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-900 focus:border-emerald-700 focus:outline-none"
              >
                {THRESHOLD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    ≥ {opt}/100
                  </option>
                ))}
              </select>
            </label>

            {pulseStatusNote && (
              <span className="text-xs text-emerald-900 font-medium">
                {pulseStatusNote}
              </span>
            )}
          </div>

          {/* Right: Live Pulse Scan + Audio/Desktop + Drawer Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onRunLivePulseScan}
              disabled={isScanningPulse}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {isScanningPulse ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Scanning Live Aso-Ebi Pulse...
                </>
              ) : (
                <>
                  <Radar className="w-3.5 h-3.5" />
                  Scan Live Market Pulse
                </>
              )}
            </button>

            {typeof window !== 'undefined' &&
              'Notification' in window &&
              desktopPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={onRequestDesktopPermission}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  Enable Desktop Push
                </button>
              )}

            <button
              type="button"
              onClick={onToggleSound}
              aria-label={soundEnabled ? 'Mute alert chime' : 'Enable alert chime'}
              title={soundEnabled ? 'Alert sound on' : 'Alert sound muted'}
              className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-800" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                unreadCount > 0
                  ? 'bg-emerald-900 text-white hover:bg-emerald-800'
                  : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Trend Alerts</span>
              <span className="font-mono tabular-nums">({unreadCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Toast Banner when a new High-Demand Alert arrives */}
      {latestToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-40 w-[min(420px,calc(100vw-2rem))] rounded-xl border border-emerald-700 bg-white shadow-xl p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                <BellRing className="w-4 h-4 shrink-0" />
                <span>High-Demand Aso-Ebi Surge Detected</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-900 mt-1">
                {latestToast.laceName}
              </h4>
              <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                Velocity {latestToast.trendVelocityScore}/100 · {latestToast.lifecycleStage} ·{' '}
                {latestToast.marketLine}
              </div>
            </div>
            <button
              type="button"
              onClick={onDismissToast}
              aria-label="Dismiss alert notification"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mt-2 line-clamp-2">
            {latestToast.recommendedAction}
          </p>

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onAcknowledgeAlert(latestToast.alertKey);
                onSimulateAlertInNpi(latestToast);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
            >
              Simulate Bale Margin
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                onAcknowledgeAlert(latestToast.alertKey);
                onPitchAlertInStudio(latestToast);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3 h-3" />
              Draft WhatsApp Pitch
            </button>
          </div>
        </div>
      )}

      {/* Slide-Over Alerts Feed Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            aria-label="High-Demand Aso-Ebi Trend Alerts"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white h-full border-l border-slate-200 flex flex-col shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Real-Time Aso-Ebi Alert Feed
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                  Trigger threshold: ≥ {threshold}/100 · {unreadCount} unread
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onAcknowledgeAll}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close alerts drawer"
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {alerts.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Bell className="w-7 h-7 text-slate-300 mx-auto" />
                  <div className="text-sm font-medium text-slate-700">
                    No high-demand alerts yet
                  </div>
                  <p className="text-xs text-slate-500">
                    Analyze a fabric swatch or click Scan Live Market Pulse to detect surges ≥{' '}
                    {threshold}/100.
                  </p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.alertKey}
                    className={`p-5 transition-colors ${
                      alert.isRead ? 'bg-white' : 'bg-emerald-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
                          <span className="font-semibold text-emerald-900">
                            Velocity {alert.trendVelocityScore}/100
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-amber-800 font-sans font-medium">
                            {alert.lifecycleStage}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-slate-500 font-sans">
                            {alert.marketLine}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {alert.laceName}
                        </h3>
                        <div className="text-xs text-slate-500">
                          {alert.laceCategory}
                          {alert.trendingColorways.length > 0
                            ? ` · ${alert.trendingColorways.slice(0, 2).join(', ')}`
                            : ''}
                        </div>
                      </div>

                      {!alert.isRead && (
                        <button
                          type="button"
                          onClick={() => onAcknowledgeAlert(alert.alertKey)}
                          title="Mark alert read"
                          className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:text-emerald-800 hover:border-emerald-300 shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <p className="mt-2.5 text-xs leading-relaxed text-slate-700">
                      {alert.recommendedAction}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onAcknowledgeAlert(alert.alertKey);
                          onSimulateAlertInNpi(alert);
                          setDrawerOpen(false);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        Simulate in NPI
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAcknowledgeAlert(alert.alertKey);
                          onPitchAlertInStudio(alert);
                          setDrawerOpen(false);
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors whitespace-nowrap"
                      >
                        <Sparkles className="w-3 h-3" />
                        Draft WhatsApp Pitch
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
