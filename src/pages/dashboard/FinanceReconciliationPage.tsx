import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Scale } from 'lucide-react';
import { financeService } from '../../services/finance.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

/**
 * Sprint 7 / SRS 18 + FR-FIN-07 — Finance reconciliation queue (incidents, gateway, bank, closing).
 */
export const FinanceReconciliationPage: React.FC = () => {
  const isOwnerReadOnly = useOwnerReadOnly();
  const [tab, setTab] = useState<'incidents' | 'gateway' | 'bank' | 'closing'>('incidents');
  const [incidents, setIncidents] = useState<any[]>([]);
  const [gateway, setGateway] = useState<any[]>([]);
  const [bank, setBank] = useState<any[]>([]);
  const [closings, setClosings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [inc, gw, bl, cl] = await Promise.all([
        financeService.getReconIncidents({ per_page: 50 }),
        financeService.getGatewayRecon({ per_page: 50 }),
        financeService.getBankLines({ per_page: 50 }),
        financeService.getReconClosings(),
      ]);
      setIncidents(inc?.data || []);
      setThreshold(inc?.threshold ?? null);
      setGateway(gw?.data || []);
      setBank(bl?.data || []);
      setClosings(cl?.data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat reconciliation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader
        title="Reconciliation Center"
        subtitle="SRS Bagian 18 / FR-FIN-07 — internal, provider, Midtrans, bank import, closing."
        icon={Scale}
      />
      {threshold != null && (
        <p className="text-xs text-gray-500">Threshold aktif: Rp {Number(threshold).toLocaleString('id-ID')}</p>
      )}
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {!isOwnerReadOnly && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              await financeService.runReconJob('internal');
              await load();
            }}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            Run Internal
          </button>
          <button
            type="button"
            onClick={async () => {
              await financeService.runReconJob('provider');
              await load();
            }}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            Run Provider
          </button>
          <button
            type="button"
            onClick={async () => {
              await financeService.runReconJob('midtrans');
              await load();
            }}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            Run Midtrans
          </button>
          <button
            type="button"
            onClick={async () => {
              await financeService.runReconJob('closing');
              await load();
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
          >
            Run Closing
          </button>
          <label className="px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer inline-flex items-center gap-2">
            Import Bank CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                await financeService.importBankCsv(f);
                await load();
                setTab('bank');
              }}
            />
          </label>
          <button type="button" onClick={() => void load()} className="px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      )}

      <div className="flex gap-2 text-xs font-bold">
        {(['incidents', 'gateway', 'bank', 'closing'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-xl border ${tab === t ? 'bg-emerald-50 border-emerald-300' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          {tab === 'incidents' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Variance</th>
                  <th className="p-3">Freeze</th>
                  <th className="p-3">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {incidents.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{r.incident_code}</td>
                    <td className="p-3">{r.type}</td>
                    <td className="p-3">Rp {Number(r.variance || 0).toLocaleString('id-ID')}</td>
                    <td className="p-3">{r.freeze_withdraw ? 'YES' : 'no'}</td>
                    <td className="p-3">{r.status}</td>
                    <td className="p-3">
                      {!isOwnerReadOnly && r.status === 'open' && (
                        <button
                          type="button"
                          className="text-xs font-bold text-emerald-700"
                          onClick={async () => {
                            await financeService.resolveReconIncident(r.id, 'Resolved from UI');
                            await load();
                          }}
                        >
                          Resolve / Unfreeze
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {incidents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-gray-400 text-sm">
                      Tidak ada incident.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {tab === 'gateway' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">External</th>
                  <th className="p-3">Internal</th>
                  <th className="p-3">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {gateway.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 text-xs">{r.recon_date}</td>
                    <td className="p-3">{r.source}</td>
                    <td className="p-3">{Number(r.external_amount || 0).toLocaleString('id-ID')}</td>
                    <td className="p-3">{Number(r.internal_amount || 0).toLocaleString('id-ID')}</td>
                    <td className="p-3">{r.match_status}</td>
                    <td className="p-3 space-x-2">
                      {!isOwnerReadOnly && r.match_status !== 'matched' && (
                        <>
                          <button
                            type="button"
                            className="text-xs font-bold text-emerald-700"
                            onClick={async () => {
                              await financeService.matchGatewayRecon(r.id, { evidence: 'UI match' });
                              await load();
                            }}
                          >
                            Match
                          </button>
                          <button
                            type="button"
                            className="text-xs font-bold text-amber-700"
                            onClick={async () => {
                              await financeService.discrepancyGatewayRecon(r.id, { evidence: 'UI discrepancy' });
                              await load();
                            }}
                          >
                            Discrepancy
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'bank' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Ref</th>
                  <th className="p-3">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {bank.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 text-xs">{r.transacted_on}</td>
                    <td className="p-3">{Number(r.amount || 0).toLocaleString('id-ID')}</td>
                    <td className="p-3 font-mono text-xs">{r.external_reference}</td>
                    <td className="p-3">{r.match_status}</td>
                    <td className="p-3 space-x-2">
                      {!isOwnerReadOnly && r.match_status === 'unmatched' && (
                        <>
                          <button
                            type="button"
                            className="text-xs font-bold text-emerald-700"
                            onClick={async () => {
                              await financeService.matchBankLine(r.id, {
                                evidence: 'UI match',
                                internal_amount: r.amount,
                              });
                              await load();
                            }}
                          >
                            Match
                          </button>
                          <button
                            type="button"
                            className="text-xs font-bold text-amber-700"
                            onClick={async () => {
                              await financeService.discrepancyBankLine(r.id, {
                                internal_amount: 0,
                                evidence: 'UI discrepancy',
                              });
                              await load();
                            }}
                          >
                            Discrepancy
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'closing' && (
            <div className="p-4 space-y-3">
              {closings.map((c) => (
                <div key={c.id} className="rounded-xl border p-3 text-xs">
                  <div className="font-bold mb-1">{c.closing_date}</div>
                  <pre className="overflow-auto max-h-48 bg-gray-50 p-2 rounded-lg">
                    {JSON.stringify(c.summary, null, 2)}
                  </pre>
                </div>
              ))}
              {closings.length === 0 && <p className="text-gray-400 text-sm">Belum ada closing snapshot.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
