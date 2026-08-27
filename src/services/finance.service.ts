/**
 * Finance Command Center API client (Sprint 8.3).
 */

import { apiClient } from './api';
import { ApiResponse } from '../types';

export const financeService = {
  async getDashboard() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/dashboard');
    return res.data;
  },

  async getCommandCenter() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/command-center');
    return res.data?.data || res.data;
  },

  async getTreasury() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/treasury');
    return res.data?.data || res.data;
  },

  async getProviderDeposits() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/provider-deposits');
    return res.data?.data || res.data;
  },

  async refreshProviderDeposits() {
    const res = await apiClient.post<ApiResponse<any>>('/admin/finance/provider-deposits/refresh');
    return res.data?.data || res.data;
  },

  async getPaymentGateways() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/payment-gateways');
    return res.data?.data || res.data;
  },

  async getWalletMonitor() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/wallets/monitor');
    return res.data?.data || res.data;
  },

  async getLedger(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/ledger', { params });
    return res.data?.data || res.data;
  },

  async getLedgerEntry(id: number) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/finance/ledger/${id}`);
    return res.data?.data || res.data;
  },

  async getSettlements(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/settlements', { params });
    return res.data;
  },

  async createSettlement(payload: Record<string, unknown>) {
    const res = await apiClient.post<ApiResponse<any>>('/admin/finance/settlements', payload);
    return res.data?.data || res.data;
  },

  async getSettlement(id: number) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/finance/settlements/${id}`);
    return res.data?.data || res.data;
  },

  async updateSettlement(id: number, payload: Record<string, unknown>) {
    const res = await apiClient.patch<ApiResponse<any>>(`/admin/finance/settlements/${id}`, payload);
    return res.data?.data || res.data;
  },

  async getAlerts(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/alerts', { params });
    return res.data?.data || res.data;
  },

  async evaluateAlerts() {
    const res = await apiClient.post<ApiResponse<any>>('/admin/finance/alerts/evaluate');
    return res.data?.data || res.data;
  },

  async ackAlert(id: number) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/alerts/${id}/ack`);
    return res.data?.data || res.data;
  },

  async resolveAlert(id: number) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/alerts/${id}/resolve`);
    return res.data?.data || res.data;
  },

  async getStructuredReports(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/reports/structured', { params });
    return res.data?.data || res.data;
  },

  async getWidgets(audience: string) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/finance/widgets/${audience}`);
    return res.data?.data || res.data;
  },

  async getSummary() {
    const cc = await this.getCommandCenter();
    return cc || {};
  },

  async getRevenueChart() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/dashboard');
    return res.data.data?.revenueChart || res.data.data?.chart || [];
  },

  async getStatusSummaries() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/dashboard');
    return res.data.data?.statusSummaries || res.data.data?.statuses || [];
  },

  async getLatestPayments() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/dashboard');
    return res.data.data?.latestPayments || res.data.data?.payments || [];
  },

  async getRefunds(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/refunds', { params });
    return res.data;
  },

  async approveRefund(id: string, data?: { notes?: string; note?: string; idempotency_key?: string }) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/refunds/${id}/approve`, {
      notes: data?.notes || data?.note,
      idempotency_key: data?.idempotency_key,
    });
    return res.data;
  },

  async rejectRefund(id: string, data?: { reason?: string; note?: string }) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/refunds/${id}/reject`, {
      reason: data?.reason || data?.note,
    });
    return res.data;
  },

  /**
   * SRS 14.1 — manual wallet adjustment (balance mutation). Caller must supply idempotency_key.
   */
  async adjustWallet(payload: {
    user_id?: number;
    email?: string;
    amount: number;
    direction: 'credit' | 'debit';
    reason: string;
    idempotency_key: string;
  }) {
    const res = await apiClient.post<ApiResponse<any>>('/admin/finance/wallet/adjust', payload);
    return res.data;
  },

  // FR-FIN-01
  async listUserWallets(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/wallets', { params });
    return res.data;
  },

  async getUserMutations(userId: number | string, params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/finance/wallets/${userId}/mutations`, { params });
    return res.data;
  },

  // FR-FIN-03 / 04
  async listManualDeposits(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/deposits', { params });
    return res.data;
  },

  async getManualDeposit(id: number | string) {
    const res = await apiClient.get<ApiResponse<any>>(`/admin/finance/deposits/${id}`);
    return res.data;
  },

  async approveManualDeposit(id: number | string, idempotency_key: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/deposits/${id}/approve`, { idempotency_key });
    return res.data;
  },

  async rejectManualDeposit(id: number | string, reason: string, idempotency_key?: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/deposits/${id}/reject`, { reason, idempotency_key });
    return res.data;
  },

  async listAutomaticDeposits(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/deposits/automatic', { params });
    return res.data;
  },

  // FR-FIN-05
  async listWithdrawals(params?: Record<string, any>) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/withdrawals', { params });
    return res.data;
  },

  async approveWithdrawal(id: number | string, idempotency_key: string, notes?: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/withdrawals/${id}/approve`, { idempotency_key, notes });
    return res.data;
  },

  async rejectWithdrawal(id: number | string, reason: string, idempotency_key: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/withdrawals/${id}/reject`, { reason, idempotency_key });
    return res.data;
  },

  async holdWithdrawal(id: number | string, idempotency_key: string, notes?: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/withdrawals/${id}/hold`, { idempotency_key, notes });
    return res.data;
  },

  // FR-FIN-08
  async exportReportBlob(params: { format: 'xlsx' | 'pdf'; period?: string; start_date?: string; end_date?: string }) {
    const res = await apiClient.get('/admin/finance/reports/export', {
      params,
      responseType: 'blob',
    });
    return res;
  },

  async getReports(params?: Record<string, any>) {
    const mapped: Record<string, any> = { ...(params || {}) };
    if (mapped.method && !mapped.payment_method) {
      mapped.payment_method = mapped.method;
      delete mapped.method;
    }
    if (mapped.date_range && !mapped.start_date) {
      const now = new Date();
      const end = now.toISOString().slice(0, 10);
      let start = end;
      const range = String(mapped.date_range).toLowerCase();
      if (range.includes('minggu') || range.includes('week')) {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        start = d.toISOString().slice(0, 10);
      } else if (range.includes('bulan') || range.includes('month')) {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      } else if (range.includes('tahun') || range.includes('year')) {
        start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      }
      mapped.start_date = start;
      mapped.end_date = end;
      delete mapped.date_range;
    }
    try {
      const structured = await this.getStructuredReports(mapped);
      if (structured?.incomeStatement) return { data: structured, success: true };
    } catch {
      /* fall through */
    }
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/reports', { params: mapped });
    return res.data;
  },

  // Sprint 7 / SRS 18 + FR-FIN-07
  async getReconIncidents(params: Record<string, unknown> = {}) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/reconciliation/incidents', { params });
    return res.data?.data || res.data;
  },
  async resolveReconIncident(id: number | string, notes?: string) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/reconciliation/incidents/${id}/resolve`, { notes });
    return res.data?.data || res.data;
  },
  async getGatewayRecon(params: Record<string, unknown> = {}) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/reconciliation/gateway', { params });
    return res.data?.data || res.data;
  },
  async matchGatewayRecon(id: number | string, body: Record<string, unknown> = {}) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/reconciliation/gateway/${id}/match`, body);
    return res.data?.data || res.data;
  },
  async discrepancyGatewayRecon(id: number | string, body: Record<string, unknown> = {}) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/reconciliation/gateway/${id}/discrepancy`, body);
    return res.data?.data || res.data;
  },
  async getBankLines(params: Record<string, unknown> = {}) {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/reconciliation/bank-lines', { params });
    return res.data?.data || res.data;
  },
  async importBankCsv(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiClient.post<ApiResponse<any>>('/admin/finance/reconciliation/bank-import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.data || res.data;
  },
  async matchBankLine(id: number | string, body: Record<string, unknown> = {}) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/reconciliation/bank-lines/${id}/match`, body);
    return res.data?.data || res.data;
  },
  async discrepancyBankLine(id: number | string, body: Record<string, unknown> = {}) {
    const res = await apiClient.post<ApiResponse<any>>(`/admin/finance/reconciliation/bank-lines/${id}/discrepancy`, body);
    return res.data?.data || res.data;
  },
  async getReconClosings() {
    const res = await apiClient.get<ApiResponse<any>>('/admin/finance/reconciliation/closings');
    return res.data?.data || res.data;
  },
  async runReconJob(mode: string) {
    const res = await apiClient.post<ApiResponse<any>>('/admin/finance/reconciliation/run', { mode });
    return res.data?.data || res.data;
  },
};

const idr = (n: number | null | undefined) =>
  `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

export { idr as formatIdr };
