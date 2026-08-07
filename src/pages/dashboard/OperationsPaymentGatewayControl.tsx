import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CreditCard,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  Star,
  Timer,
  Wrench,
  X,
} from 'lucide-react';
import { operationsService } from '../../services/operations.service';

type GatewayCard = {
  id: string;
  code: string;
  name: string;
  integrated?: boolean;
  enabled: boolean;
  status: string;
  priority: number;
  apiStatus?: string;
  apiStatusLabel?: string;
  healthColor?: string;
  healthLabel?: string;
  statusDescription?: string;
  lastHealthCheckAt?: string | null;
  supportedServices?: string[];
  note?: string;
};

type GatewayLog = {
  id: number;
  eventType: string;
  createdAt?: string;
};

const formatTs = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('id-ID');
  } catch {
    return iso;
  }
};

const healthTone = (color?: string) => {
  const c = (color || '').toLowerCase();
  if (c === 'green') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (c === 'yellow') return 'bg-amber-50 text-amber-900 border-amber-200';
  if (c === 'orange') return 'bg-orange-50 text-orange-900 border-orange-200';
  return 'bg-rose-50 text-rose-800 border-rose-200';
};

export const OperationsPaymentGatewayControl: React.FC = () => {
  const [cards, setCards] = useState<GatewayCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<GatewayLog[]>([]);
  const [logsTitle, setLogsTitle] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await operationsService.getPaymentGatewayControl();
      const data = res?.data ?? res;
      setCards(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat Payment Gateway Control Center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (code: string, fn: () => Promise<any>, okMsg: string) => {
    setBusyCode(code);
    try {
      await fn();
      setToast(okMsg);
      await load();
    } catch (e: any) {
      setToast(e?.response?.data?.message || e?.message || 'Aksi gagal');
    } finally {
      setBusyCode(null);
      setTimeout(() => setToast(null), 3500);
    }
  };

  const openLogs = async (card: GatewayCard) => {
    setLogsTitle(card.name);
    setLogsOpen(true);
    try {
      const res = await operationsService.getPaymentGatewayLogs(card.code);
      const data = res?.data ?? res;
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {toast && (
        <div className="fixed top-20 right-6 z-50 max-w-md p-4 rounded-2xl shadow-2xl border bg-slate-900 text-white border-slate-700 text-xs font-semibold">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payment Gateway Control Center</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Kendali gateway pembayaran untuk top up saldo (QRIS, VA, e-wallet). Bukan untuk transaksi PPOB.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {loading && cards.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Memuat payment gateway…
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {cards.map((card) => {
            const busy = busyCode === card.code;
            const canControl = card.integrated !== false;
            return (
              <div key={card.code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900">{card.name}</h2>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{card.code}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                      card.enabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${card.enabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {card.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>

                <div className={`mb-4 rounded-xl border px-3 py-2.5 text-[12px] font-semibold ${healthTone(card.healthColor)}`}>
                  <div className="font-extrabold">{card.status}</div>
                  <p className="font-medium mt-0.5 opacity-90">
                    {card.statusDescription || 'Status gateway belum diperiksa.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                      <Star className="w-3 h-3" /> Priority
                    </div>
                    <div className="font-extrabold text-slate-800">{card.priority}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Health
                    </div>
                    <div className="font-extrabold text-slate-800">{card.healthLabel || card.apiStatusLabel || '—'}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 col-span-2">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                      <Timer className="w-3 h-3" /> Health Check Terakhir
                    </div>
                    <div className="font-extrabold text-slate-800">{formatTs(card.lastHealthCheckAt)}</div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mb-4">
                  {(card.supportedServices || []).join(', ') || 'Top Up Saldo'}
                  {card.note ? ` · ${card.note}` : ''}
                </p>

                <div className="flex flex-wrap gap-2">
                  {canControl && (
                    <>
                      <ActionBtn
                        disabled={busy}
                        onClick={() =>
                          runAction(card.code, () => operationsService.healthCheckPaymentGateway(card.code), 'Health check selesai')
                        }
                      >
                        Health Check
                      </ActionBtn>
                      {card.enabled ? (
                        <ActionBtn
                          disabled={busy}
                          tone="warn"
                          onClick={() =>
                            runAction(card.code, () => operationsService.disablePaymentGateway(card.code), 'Gateway dimatikan')
                          }
                        >
                          <PowerOff className="w-3.5 h-3.5" /> Turn OFF
                        </ActionBtn>
                      ) : (
                        <ActionBtn
                          disabled={busy}
                          tone="ok"
                          onClick={() =>
                            runAction(card.code, () => operationsService.enablePaymentGateway(card.code), 'Gateway diaktifkan')
                          }
                        >
                          <Power className="w-3.5 h-3.5" /> Turn ON
                        </ActionBtn>
                      )}
                      <ActionBtn
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            card.code,
                            () => operationsService.setPaymentGatewayMaintenance(card.code),
                            'Mode maintenance aktif'
                          )
                        }
                      >
                        <Wrench className="w-3.5 h-3.5" /> Maintenance
                      </ActionBtn>
                      <ActionBtn
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            card.code,
                            () => operationsService.setPaymentGatewayPriority(card.code, 1),
                            'Prioritas diatur ke 1'
                          )
                        }
                      >
                        <Star className="w-3.5 h-3.5" /> Set Priority 1
                      </ActionBtn>
                    </>
                  )}
                  <ActionBtn disabled={busy} onClick={() => openLogs(card)}>
                    View Logs
                  </ActionBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {logsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900">Logs — {logsTitle}</h3>
              <button type="button" onClick={() => setLogsOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Belum ada log.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs">
                    <div className="flex justify-between gap-2 font-bold text-slate-800">
                      <span>{log.eventType}</span>
                      <span className="text-slate-400 font-medium">{formatTs(log.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionBtn: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'ok' | 'warn';
}> = ({ children, onClick, disabled, tone = 'default' }) => {
  const tones =
    tone === 'ok'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-extrabold transition disabled:opacity-50 ${tones}`}
    >
      {children}
    </button>
  );
};
