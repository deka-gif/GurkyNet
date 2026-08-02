/**
 * Backend Integration Checklist
 * Centralized audit document mapping every frontend page/module to its required services,
 * APIs, required data payload, and current integration status.
 */

export interface IntegrationChecklistEntry {
  id: string;
  pageName: string;
  category: 'Public / User' | 'Finance' | 'Operations' | 'Marketing' | 'Customer Support' | 'Owner Executive';
  requiredServices: string[];
  requiredApis: string[];
  requiredData: string[];
  currentStatus: 'Dummy Service' | 'Ready for Integration' | 'Pending Backend Endpoint';
  futureBackendTarget: string;
}

export const BACKEND_INTEGRATION_CHECKLIST: IntegrationChecklistEntry[] = [
  // ----------------------------------------------------
  // PUBLIC / USER DASHBOARD PAGES
  // ----------------------------------------------------
  {
    id: 'page-auth-login',
    pageName: 'Login Page',
    category: 'Public / User',
    requiredServices: ['authService', 'storageService'],
    requiredApis: ['POST /api/v1/auth/login', 'GET /api/v1/auth/me'],
    requiredData: ['User Credentials (email, password)', 'Sanctum Bearer Token', 'User Object (id, role, name, email)'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Sanctum Authentication Controller'
  },
  {
    id: 'page-auth-register',
    pageName: 'Register Page',
    category: 'Public / User',
    requiredServices: ['authService'],
    requiredApis: ['POST /api/v1/auth/register'],
    requiredData: ['Registration Fields (name, email, phone, password)', 'Verification Token'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Auth Registration Controller'
  },
  {
    id: 'page-dashboard-home',
    pageName: 'Dashboard Home',
    category: 'Public / User',
    requiredServices: ['walletService', 'notificationService', 'bannerService', 'productService'],
    requiredApis: [
      'GET /api/v1/wallet',
      'GET /api/v1/notifications',
      'GET /api/v1/admin/banners',
      'GET /api/v1/transactions?limit=5'
    ],
    requiredData: ['Balance Summary', 'Unread Notifications Count', 'Active Promo Banners', 'Recent Transaction History'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Dashboard Aggregate API Service'
  },
  {
    id: 'page-wallet',
    pageName: 'Wallet & Top Up',
    category: 'Public / User',
    requiredServices: ['walletService'],
    requiredApis: [
      'GET /api/v1/wallet',
      'GET /api/v1/wallet/history',
      'POST /api/v1/wallet/topup'
    ],
    requiredData: ['Wallet Balance', 'Pending Top Ups', 'Transaction Ledger History', 'Payment Gateway Method Links'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Payment & Wallet Ledger Service'
  },
  {
    id: 'page-transfer',
    pageName: 'Transfer Balance',
    category: 'Public / User',
    requiredServices: ['walletService', 'userService'],
    requiredApis: ['POST /api/v1/wallet/transfer', 'GET /api/v1/admin/customers'],
    requiredData: ['Recipient Account / Phone Number Validation', 'Transfer Amount & Note', 'PIN / Password Auth'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Internal Peer Transfer Engine'
  },
  {
    id: 'page-pulsa',
    pageName: 'Pulsa Telco Service',
    category: 'Public / User',
    requiredServices: ['productService', 'transactionService'],
    requiredApis: [
      'GET /api/v1/products?category=pulsa',
      'POST /api/v1/transactions'
    ],
    requiredData: ['Destination Phone Number', 'Operator Detection', 'SKU Package List', 'Price Margins'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel PPOB Provider Dispatcher (Digiflazz/Alterra)'
  },
  {
    id: 'page-paket-data',
    pageName: 'Paket Data Telco Service',
    category: 'Public / User',
    requiredServices: ['productService', 'transactionService'],
    requiredApis: [
      'GET /api/v1/products?category=data',
      'POST /api/v1/transactions'
    ],
    requiredData: ['Operator Code', 'Data Volume Variants', 'Transaction Request SKU'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel PPOB Provider Gateway'
  },
  {
    id: 'page-token-pln',
    pageName: 'Token PLN & Bill Service',
    category: 'Public / User',
    requiredServices: ['productService', 'transactionService'],
    requiredApis: [
      'GET /api/v1/products?category=pln',
      'POST /api/v1/transactions'
    ],
    requiredData: ['Meter ID / Customer Number Verification', 'Token Denominations', 'Strum Code Output'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel PLN H2H API Integration'
  },
  {
    id: 'page-tagihan',
    pageName: 'PPOB Bills Service (BPJS, PDAM, Indihome)',
    category: 'Public / User',
    requiredServices: ['productService', 'transactionService'],
    requiredApis: [
      'GET /api/v1/products?category=bills',
      'POST /api/v1/transactions'
    ],
    requiredData: ['Inquiry Customer Number', 'Bill Details (Penalty, Month, Total Fee)', 'Payment Settlement Request'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Bill Inquiry & Payment Processor'
  },
  {
    id: 'page-voucher',
    pageName: 'Voucher & Game Voucher',
    category: 'Public / User',
    requiredServices: ['productService', 'transactionService'],
    requiredApis: [
      'GET /api/v1/products?category=voucher',
      'POST /api/v1/transactions'
    ],
    requiredData: ['Voucher SKU Catalog', 'Game Zone ID / Server Validation', 'Serial Code Output'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Game Provider H2H Engine'
  },
  {
    id: 'page-riwayat',
    pageName: 'Transaction History',
    category: 'Public / User',
    requiredServices: ['transactionService'],
    requiredApis: [
      'GET /api/v1/transactions',
      'GET /api/v1/transactions/{id}',
      'GET /api/v1/transactions/{id}/receipt'
    ],
    requiredData: ['Date Range Filter', 'Status Badges', 'Printable PDF / Thermal Receipt Endpoint'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Transaction History Service'
  },
  {
    id: 'page-profil',
    pageName: 'User Profile & Settings',
    category: 'Public / User',
    requiredServices: ['userService', 'authService'],
    requiredApis: [
      'GET /api/v1/profile',
      'PUT /api/v1/profile'
    ],
    requiredData: ['KYC Verification Details', 'Security PIN / Password Change', 'Avatar Upload Base64/S3'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel User Profile Controller'
  },
  {
    id: 'page-notifikasi',
    pageName: 'Notifications Center',
    category: 'Public / User',
    requiredServices: ['notificationService'],
    requiredApis: [
      'GET /api/v1/notifications',
      'PUT /api/v1/notifications/read'
    ],
    requiredData: ['Push / System Notifications', 'Timestamp', 'Read Status Toggle'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Notification Database Channel'
  },

  // ----------------------------------------------------
  // FINANCE MODULE
  // ----------------------------------------------------
  {
    id: 'page-finance-dashboard',
    pageName: 'Finance Dashboard Overview',
    category: 'Finance',
    requiredServices: ['financeService'],
    requiredApis: [
      'GET /api/v1/admin/finance/dashboard',
      'GET /api/v1/transactions'
    ],
    requiredData: ['Daily Revenue Metrics', 'Gross Profit Margin', 'Auto-Settlement Rate', 'Pending Settlement Queue'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Financial Analytics Aggregator'
  },
  {
    id: 'page-finance-report',
    pageName: 'Financial Report Center',
    category: 'Finance',
    requiredServices: ['financeService'],
    requiredApis: ['GET /api/v1/admin/finance/reports'],
    requiredData: ['P&L Statement Data', 'Export CSV/Excel Stream', 'Provider Fee Breakdown'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Financial Reporting Engine'
  },
  {
    id: 'page-finance-refund',
    pageName: 'Refund Approval Module',
    category: 'Finance',
    requiredServices: ['financeService', 'customerSupportService'],
    requiredApis: ['GET /api/v1/admin/finance/refunds'],
    requiredData: ['Escalated Refund Claims', 'Customer Balance Adjustment API', 'Approval Workflow Signatures'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Ledger Refund Controller'
  },
  {
    id: 'page-finance-settlement',
    pageName: 'Settlement Management',
    category: 'Finance',
    requiredServices: ['financeService'],
    requiredApis: ['GET /api/v1/admin/finance/settlements'],
    requiredData: ['Payment Gateway Batch Settlements', 'Disbursement Status', 'Bank Recalibration Logs'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Settlement Reconciliation Service'
  },

  // ----------------------------------------------------
  // OPERATIONS MODULE
  // ----------------------------------------------------
  {
    id: 'page-operations-dashboard',
    pageName: 'Operations Dashboard Overview',
    category: 'Operations',
    requiredServices: ['operationsService'],
    requiredApis: [
      'GET /api/v1/admin/operations/dashboard',
      'GET /api/v1/providers'
    ],
    requiredData: ['Provider Latency Times', 'H2H Callback Success Rate', 'System Error Alerts'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel System Operations Monitor'
  },
  {
    id: 'page-operations-products',
    pageName: 'Product Management',
    category: 'Operations',
    requiredServices: ['productService', 'operationsService'],
    requiredApis: [
      'GET /api/v1/admin/products',
      'GET /api/v1/products/{sku}'
    ],
    requiredData: ['SKU Status Toggle (Active/Maintenance)', 'Base Price & Supplier Sync', 'Cutoff Time Scheduling'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Product Catalog Manager'
  },
  {
    id: 'page-operations-providers',
    pageName: 'Provider Management',
    category: 'Operations',
    requiredServices: ['operationsService'],
    requiredApis: ['GET /api/v1/admin/providers'],
    requiredData: ['H2H Provider Balance', 'Webhook URL Settings', 'Failover Provider Priority Switching'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel H2H Gateway Router'
  },
  {
    id: 'page-operations-pricing',
    pageName: 'Dynamic Pricing Management',
    category: 'Operations',
    requiredServices: ['operationsService'],
    requiredApis: ['GET /api/v1/admin/pricing'],
    requiredData: ['Margin Multiplier Config', 'User Group Discount Matrices', 'Promo Price Overrides'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Pricing Engine Controller'
  },

  // ----------------------------------------------------
  // MARKETING MODULE
  // ----------------------------------------------------
  {
    id: 'page-marketing-dashboard',
    pageName: 'Marketing Dashboard Overview',
    category: 'Marketing',
    requiredServices: ['marketingService'],
    requiredApis: [
      'GET /api/v1/admin/banners',
      'GET /api/v1/admin/promotions'
    ],
    requiredData: ['Active Campaign Performance', 'Voucher Conversion Rate', 'Banner Click CTR'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Marketing Analytics Service'
  },
  {
    id: 'page-marketing-banners',
    pageName: 'Banner Management',
    category: 'Marketing',
    requiredServices: ['marketingService'],
    requiredApis: ['GET /api/v1/admin/banners'],
    requiredData: ['Banner Image Upload Endpoint', 'Target Deep Links', 'Sequence Weight'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Media & Banner Controller'
  },
  {
    id: 'page-marketing-promotions',
    pageName: 'Promotion & Campaign Management',
    category: 'Marketing',
    requiredServices: ['marketingService'],
    requiredApis: ['GET /api/v1/admin/promotions'],
    requiredData: ['Campaign Start/End Schedules', 'Target Audience Segment Filters', 'Cashback Terms'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Campaign Engine'
  },
  {
    id: 'page-marketing-vouchers',
    pageName: 'Voucher Management',
    category: 'Marketing',
    requiredServices: ['marketingService'],
    requiredApis: ['GET /api/v1/admin/vouchers'],
    requiredData: ['Promo Code Generator', 'Quota Limits', 'Discount Percentage / Fixed Cap'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Voucher & Coupon Service'
  },
  {
    id: 'page-marketing-announcements',
    pageName: 'Announcement Center',
    category: 'Marketing',
    requiredServices: ['marketingService'],
    requiredApis: ['GET /api/v1/admin/announcements'],
    requiredData: ['Broadcast Message Templates', 'Modal Popup Triggers', 'Target User Roles'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Announcement Broadcast Engine'
  },

  // ----------------------------------------------------
  // CUSTOMER SUPPORT MODULE
  // ----------------------------------------------------
  {
    id: 'page-cs-dashboard',
    pageName: 'Customer Support Dashboard Overview',
    category: 'Customer Support',
    requiredServices: ['customerSupportService'],
    requiredApis: [
      'GET /api/v1/admin/tickets',
      'GET /api/v1/admin/customers'
    ],
    requiredData: ['Open Tickets Count', 'Avg First Response Time', 'SLA Breach Warnings', 'Recent Inquiries'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Helpdesk Aggregator Service'
  },
  {
    id: 'page-cs-tickets',
    pageName: 'Ticket Management List & Detail',
    category: 'Customer Support',
    requiredServices: ['customerSupportService'],
    requiredApis: [
      'GET /api/v1/admin/tickets',
      'GET /api/v1/admin/tickets/{id}'
    ],
    requiredData: ['Ticket Status (Open/In Progress/Resolved)', 'Message Conversation Thread', 'Assignee CS Staff'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Support Ticket Controller'
  },
  {
    id: 'page-cs-customers',
    pageName: 'Customer Profile Directory',
    category: 'Customer Support',
    requiredServices: ['customerSupportService', 'userService'],
    requiredApis: ['GET /api/v1/admin/customers'],
    requiredData: ['User Account Info', 'KYC Verification Status', 'Wallet Audit Trail', 'Account Lock/Unlock'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Customer Management Controller'
  },
  {
    id: 'page-cs-investigation',
    pageName: 'Transaction Investigation',
    category: 'Customer Support',
    requiredServices: ['customerSupportService', 'transactionService'],
    requiredApis: ['GET /api/v1/transactions'],
    requiredData: ['Raw H2H Request/Response Logs', 'Provider Reference SN', 'Manual Retry Trigger'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Transaction Audit Controller'
  },
  {
    id: 'page-cs-refunds',
    pageName: 'Refund Center',
    category: 'Customer Support',
    requiredServices: ['customerSupportService'],
    requiredApis: ['GET /api/v1/admin/refunds'],
    requiredData: ['Refund Request Details', 'Proof Attachment Uploads', 'Escalation to Finance Trigger'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel CS Refund Claim Service'
  },
  {
    id: 'page-cs-kb',
    pageName: 'Knowledge Base',
    category: 'Customer Support',
    requiredServices: ['customerSupportService'],
    requiredApis: ['GET /api/v1/admin/knowledge-base'],
    requiredData: ['SOP Articles', 'Canned Responses', 'Troubleshooting Guides'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Knowledge Base Article Controller'
  },

  // ----------------------------------------------------
  // EXECUTIVE OWNER MODULE
  // ----------------------------------------------------
  {
    id: 'page-owner-dashboard',
    pageName: 'Executive Owner Dashboard',
    category: 'Owner Executive',
    requiredServices: ['ownerService', 'financeService', 'operationsService'],
    requiredApis: ['GET /api/v1/admin/executive/dashboard'],
    requiredData: ['High-level Gross Revenue', 'System Uptime Status', 'Top Performing Customers', 'Audit Log Stream'],
    currentStatus: 'Dummy Service',
    futureBackendTarget: 'Laravel Executive Dashboard Aggregator'
  }
];
