/**
 * Centralized API Endpoints Contract
 * Complete mapping of all frontend services to Laravel backend RESTful routes (/api/v1/...)
 */

export const API_ENDPOINTS_V1 = {
  // ----------------------------------------------------
  // AUTHENTICATION & SESSION
  // ----------------------------------------------------
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    ME: '/api/v1/auth/me',
    REGISTER: '/api/v1/auth/register',
    REFRESH: '/api/v1/auth/refresh',
    FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
    RESET_PASSWORD: '/api/v1/auth/reset-password',
  },

  // ----------------------------------------------------
  // USER & PROFILE
  // ----------------------------------------------------
  USER: {
    GET_PROFILE: '/api/v1/profile',
    UPDATE_PROFILE: '/api/v1/profile', // PUT
    UPDATE_AVATAR: '/api/v1/profile/avatar', // POST
    CHANGE_PASSWORD: '/api/v1/profile/password', // PUT
    VERIFY_KYC: '/api/v1/profile/kyc', // POST
  },

  // ----------------------------------------------------
  // NOTIFICATION CENTER
  // ----------------------------------------------------
  NOTIFICATION: {
    GET_ALL: '/api/v1/notifications',
    READ: (id: string | number) => `/api/v1/notifications/${id}/read`,
    READ_ALL: '/api/v1/notifications/read-all',
    DELETE: (id: string | number) => `/api/v1/notifications/${id}`,
  },

  // ----------------------------------------------------
  // WALLET & LEDGER
  // ----------------------------------------------------
  WALLET: {
    GET_BALANCE: '/api/v1/wallet',
    GET_HISTORY: '/api/v1/wallet/history',
    TOPUP: '/api/v1/wallet/topup', // POST
    TRANSFER: '/api/v1/wallet/transfer', // POST
  },

  // ----------------------------------------------------
  // PRODUCT CATALOG & PROVIDERS
  // ----------------------------------------------------
  PRODUCT: {
    GET_CATEGORIES: '/api/v1/categories',
    GET_PROVIDERS: '/api/v1/providers',
    GET_PRODUCTS: '/api/v1/products',
    GET_PRODUCT_BY_SKU: (sku: string) => `/api/v1/products/${sku}`,
  },

  // ----------------------------------------------------
  // TRANSACTIONS & PURCHASES
  // ----------------------------------------------------
  TRANSACTION: {
    GET_ALL: '/api/v1/transactions',
    CREATE: '/api/v1/transactions', // POST
    GET_BY_ID: (id: string | number) => `/api/v1/transactions/${id}`,
    CANCEL: (id: string | number) => `/api/v1/transactions/${id}/cancel`, // POST
    GET_RECEIPT: (id: string | number) => `/api/v1/transactions/${id}/receipt`,
  },

  // ----------------------------------------------------
  // FINANCE ADMINISTRATION
  // ----------------------------------------------------
  FINANCE: {
    GET_DASHBOARD: '/api/v1/admin/finance/dashboard',
    GET_REPORTS: '/api/v1/admin/finance/reports',
    GET_REFUNDS: '/api/v1/admin/finance/refunds',
    APPROVE_REFUND: (id: string | number) => `/api/v1/admin/finance/refunds/${id}/approve`, // POST
    REJECT_REFUND: (id: string | number) => `/api/v1/admin/finance/refunds/${id}/reject`, // POST
    GET_SETTLEMENTS: '/api/v1/admin/finance/settlements',
    TRIGGER_SETTLEMENT: '/api/v1/admin/finance/settlements/trigger', // POST
  },

  // ----------------------------------------------------
  // OPERATIONS ADMINISTRATION
  // ----------------------------------------------------
  OPERATIONS: {
    GET_DASHBOARD: '/api/v1/admin/operations/dashboard',
    GET_PRODUCTS: '/api/v1/admin/operations/products',
    UPDATE_PRODUCT: (id: string | number) => `/api/v1/admin/operations/products/${id}`, // PUT
    GET_PROVIDERS: '/api/v1/admin/operations/providers',
    UPDATE_PROVIDER: (id: string | number) => `/api/v1/admin/operations/providers/${id}`, // PUT
    GET_PRICING: '/api/v1/admin/operations/pricing',
    UPDATE_PRICING: '/api/v1/admin/operations/pricing', // PUT
    GET_SERVICE_HEALTH: '/api/v1/admin/operations/service-health',
  },

  // ----------------------------------------------------
  // MARKETING ADMINISTRATION
  // ----------------------------------------------------
  MARKETING: {
    GET_BANNERS: '/api/v1/admin/marketing/banners',
    CREATE_BANNER: '/api/v1/admin/marketing/banners', // POST
    DELETE_BANNER: (id: string | number) => `/api/v1/admin/marketing/banners/${id}`, // DELETE
    GET_PROMOTIONS: '/api/v1/admin/marketing/promotions',
    CREATE_PROMOTION: '/api/v1/admin/marketing/promotions', // POST
    GET_VOUCHERS: '/api/v1/admin/marketing/vouchers',
    CREATE_VOUCHER: '/api/v1/admin/marketing/vouchers', // POST
    GET_ANNOUNCEMENTS: '/api/v1/admin/marketing/announcements',
    CREATE_ANNOUNCEMENT: '/api/v1/admin/marketing/announcements', // POST
  },

  // ----------------------------------------------------
  // CUSTOMER SUPPORT ADMINISTRATION
  // ----------------------------------------------------
  CUSTOMER_SUPPORT: {
    GET_TICKETS: '/api/v1/admin/customer-support/tickets',
    GET_TICKET_BY_ID: (id: string | number) => `/api/v1/admin/customer-support/tickets/${id}`,
    REPLY_TICKET: (id: string | number) => `/api/v1/admin/customer-support/tickets/${id}/reply`, // POST
    UPDATE_TICKET_STATUS: (id: string | number) => `/api/v1/admin/customer-support/tickets/${id}/status`, // PUT
    GET_CUSTOMERS: '/api/v1/admin/customer-support/customers',
    GET_CUSTOMER_BY_ID: (id: string | number) => `/api/v1/admin/customer-support/customers/${id}`,
    GET_REFUNDS: '/api/v1/admin/customer-support/refunds',
    CREATE_REFUND_CLAIM: '/api/v1/admin/customer-support/refunds', // POST
    GET_KNOWLEDGE_BASE: '/api/v1/admin/customer-support/knowledge-base',
  },

  // ----------------------------------------------------
  // EXECUTIVE OWNER ADMINISTRATION
  // ----------------------------------------------------
  OWNER: {
    GET_DASHBOARD: '/api/v1/admin/executive/dashboard',
    GET_SYSTEM_HEALTH: '/api/v1/admin/executive/system-health',
    GET_AUDIT_LOGS: '/api/v1/admin/executive/audit-logs',
  }
} as const;
