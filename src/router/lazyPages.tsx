import { lazy, type ComponentType } from 'react';

function lazyNamed<T extends Record<string, ComponentType<any>>>(
  loader: () => Promise<T>,
  exportName: keyof T
) {
  return lazy(async () => {
    const mod = await loader();
    return { default: mod[exportName] as ComponentType<any> };
  });
}

/* —— User dashboard core (Sprint 1–5 surfaces) —— */
export const DashboardHomePage = lazyNamed(
  () => import('../pages/dashboard/DashboardHomePage'),
  'DashboardHomePage'
);
export const PromoDetailPage = lazyNamed(
  () => import('../pages/dashboard/PromoDetailPage'),
  'PromoDetailPage'
);
export const TransactionDetailPage = lazyNamed(
  () => import('../pages/dashboard/TransactionDetailPage'),
  'TransactionDetailPage'
);
export const CustomerChatPage = lazyNamed(
  () => import('../pages/dashboard/CustomerChatPage'),
  'CustomerChatPage'
);
export const RiwayatPage = lazyNamed(
  () => import('../pages/dashboard/RiwayatPage'),
  'RiwayatPage'
);
export const WalletPage = lazyNamed(() => import('../pages/dashboard/WalletPage'), 'WalletPage');
export const NotifikasiPage = lazyNamed(
  () => import('../pages/dashboard/NotifikasiPage'),
  'NotifikasiPage'
);

export const PulsaPage = lazyNamed(() => import('../pages/dashboard/PulsaPage'), 'PulsaPage');
export const PaketDataPage = lazyNamed(
  () => import('../pages/dashboard/PaketDataPage'),
  'PaketDataPage'
);
export const TokenPlnPage = lazyNamed(
  () => import('../pages/dashboard/TokenPlnPage'),
  'TokenPlnPage'
);
export const GamePage = lazyNamed(() => import('../pages/dashboard/GamePage'), 'GamePage');
export const VoucherDigitalPage = lazyNamed(
  () => import('../pages/dashboard/VoucherDigitalPage'),
  'VoucherDigitalPage'
);
export const VoucherInternetPage = lazyNamed(
  () => import('../pages/dashboard/VoucherInternetPage'),
  'VoucherInternetPage'
);
export const VoucherElektronikZonaPage = lazyNamed(
  () => import('../pages/dashboard/VoucherElektronikZonaPage'),
  'VoucherElektronikZonaPage'
);
export const VoucherFisikZonaPage = lazyNamed(
  () => import('../pages/dashboard/VoucherFisikZonaPage'),
  'VoucherFisikZonaPage'
);
export const TransferPage = lazyNamed(
  () => import('../pages/dashboard/TransferPage'),
  'TransferPage'
);

export const TelekomunikasiHubPage = lazyNamed(
  () => import('../pages/dashboard/ServiceHubPages'),
  'TelekomunikasiHubPage'
);
export const TagihanHubPage = lazyNamed(
  () => import('../pages/dashboard/ServiceHubPages'),
  'TagihanHubPage'
);
export const AllProductsPage = lazyNamed(
  () => import('../pages/dashboard/ServiceHubPages'),
  'AllProductsPage'
);

export const TopUpDigitalPage = lazyNamed(
  () => import('../pages/dashboard/MappedCatalogPages'),
  'TopUpDigitalPage'
);
export const LanggananDigitalPage = lazyNamed(
  () => import('../pages/dashboard/MappedCatalogPages'),
  'LanggananDigitalPage'
);
export const InternationalTopUpPage = lazyNamed(
  () => import('../pages/dashboard/MappedCatalogPages'),
  'InternationalTopUpPage'
);
export const TelcoSmsTeleponPage = lazyNamed(
  () => import('../pages/dashboard/MappedCatalogPages'),
  'TelcoSmsTeleponPage'
);
export const TelcoMasaAktifPage = lazyNamed(
  () => import('../pages/dashboard/MappedCatalogPages'),
  'TelcoMasaAktifPage'
);
export const TelcoAktivasiPerdanaPage = lazyNamed(
  () => import('../pages/dashboard/MappedCatalogPages'),
  'TelcoAktivasiPerdanaPage'
);
export const TelcoEsimPage = lazyNamed(
  () => import('../pages/dashboard/MappedCatalogPages'),
  'TelcoEsimPage'
);
export const TagihanSubPage = lazyNamed(
  () => import('../pages/dashboard/MappedCatalogPages'),
  'TagihanSubPage'
);

/* —— Account —— */
export const AccountHubPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountHubPage'
);
export const AccountSettingsPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountSettingsPage'
);
export const AccountEditPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountEditPage'
);
export const AccountPinPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountPinPage'
);
export const AccountSecurityPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountSecurityPage'
);
export const AccountWalletPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountWalletPage'
);
export const AccountKycPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountKycPage'
);
export const AccountLoyaltyPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountLoyaltyPage'
);
export const AccountReferralPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountReferralPage'
);
export const AccountSubscriptionsPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountSubscriptionsPage'
);
export const AccountComplaintsPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountComplaintsPage'
);
export const AccountComplaintCreatePage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountComplaintCreatePage'
);
export const AccountComplaintDetailPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountComplaintDetailPage'
);
export const AccountHelpPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountHelpPage'
);
export const AccountCmsPage = lazyNamed(
  () => import('../pages/dashboard/account'),
  'AccountCmsPage'
);

/* —— Staff / Marketing (heavy) —— */
export const MarketingDashboard = lazyNamed(
  () => import('../pages/dashboard/MarketingDashboard'),
  'MarketingDashboard'
);
export const MarketingBannerManagement = lazyNamed(
  () => import('../pages/dashboard/MarketingBannerManagement'),
  'MarketingBannerManagement'
);
export const MarketingPromotionManagement = lazyNamed(
  () => import('../pages/dashboard/MarketingPromotionManagement'),
  'MarketingPromotionManagement'
);
export const MarketingVoucherManagement = lazyNamed(
  () => import('../pages/dashboard/MarketingVoucherManagement'),
  'MarketingVoucherManagement'
);
export const MarketingAnnouncementCenter = lazyNamed(
  () => import('../pages/dashboard/MarketingAnnouncementCenter'),
  'MarketingAnnouncementCenter'
);
export const MarketingWebsiteSettings = lazyNamed(
  () => import('../pages/dashboard/MarketingWebsiteSettings'),
  'MarketingWebsiteSettings'
);
export const MarketingHomepageSections = lazyNamed(
  () => import('../pages/dashboard/MarketingHomepageSections'),
  'MarketingHomepageSections'
);

export const MarketingHomepageBuilder = lazyNamed(
  () => import('../pages/dashboard/MarketingHomepageBuilder'),
  'MarketingHomepageBuilder'
);
export const MarketingLegalCenter = lazyNamed(
  () => import('../pages/dashboard/MarketingLegalCenter'),
  'MarketingLegalCenter'
);
export const MarketingWebsiteMenu = lazyNamed(
  () => import('../pages/dashboard/MarketingWebsiteMenu'),
  'MarketingWebsiteMenu'
);
export const MarketingStaticPages = lazyNamed(
  () => import('../pages/dashboard/MarketingStaticPages'),
  'MarketingStaticPages'
);
export const MarketingMediaLibrary = lazyNamed(
  () => import('../pages/dashboard/MarketingMediaLibrary'),
  'MarketingMediaLibrary'
);
export const MarketingBrandLogoManagement = lazyNamed(
  () => import('../pages/dashboard/MarketingBrandLogoManagement'),
  'MarketingBrandLogoManagement'
);

export const CustomerSupportDashboard = lazyNamed(
  () => import('../pages/dashboard/CustomerSupportDashboard'),
  'CustomerSupportDashboard'
);
export const CustomerSupportTickets = lazyNamed(
  () => import('../pages/dashboard/CustomerSupportTickets'),
  'CustomerSupportTickets'
);
export const CustomerSupportTicketDetail = lazyNamed(
  () => import('../pages/dashboard/CustomerSupportTicketDetail'),
  'CustomerSupportTicketDetail'
);
export const CustomerSupportCustomerProfile = lazyNamed(
  () => import('../pages/dashboard/CustomerSupportCustomerProfile'),
  'CustomerSupportCustomerProfile'
);
export const CustomerSupportTransactionInvestigation = lazyNamed(
  () => import('../pages/dashboard/CustomerSupportTransactionInvestigation'),
  'CustomerSupportTransactionInvestigation'
);
export const CustomerSupportRefundCenter = lazyNamed(
  () => import('../pages/dashboard/CustomerSupportRefundCenter'),
  'CustomerSupportRefundCenter'
);
export const CustomerSupportKnowledgeBase = lazyNamed(
  () => import('../pages/dashboard/CustomerSupportKnowledgeBase'),
  'CustomerSupportKnowledgeBase'
);
export const KycReviewQueuePage = lazyNamed(
  () => import('../pages/dashboard/KycReviewPages'),
  'KycReviewQueuePage'
);
export const KycReviewDetailPage = lazyNamed(
  () => import('../pages/dashboard/KycReviewPages'),
  'KycReviewDetailPage'
);
export const CustomerSupportInbox = lazyNamed(
  () => import('../pages/dashboard/CustomerSupportInbox'),
  'CustomerSupportInbox'
);
export const HelpCenterPage = lazyNamed(
  () => import('../pages/dashboard/HelpCenterPage'),
  'HelpCenterPage'
);
export const OperationsIssueQueue = lazyNamed(
  () => import('../pages/dashboard/DivisionEscalationQueues'),
  'OperationsIssueQueue'
);
export const FinanceEscalationQueue = lazyNamed(
  () => import('../pages/dashboard/DivisionEscalationQueues'),
  'FinanceEscalationQueue'
);
export const MarketingFeedbackQueue = lazyNamed(
  () => import('../pages/dashboard/DivisionEscalationQueues'),
  'MarketingFeedbackQueue'
);
export const AdminGlobalWorkflowQueue = lazyNamed(
  () => import('../pages/dashboard/DivisionEscalationQueues'),
  'AdminGlobalWorkflowQueue'
);
export const CsWorkflowReadQueue = lazyNamed(
  () => import('../pages/dashboard/DivisionEscalationQueues'),
  'CsWorkflowReadQueue'
);

export const FinanceDashboard = lazyNamed(
  () => import('../pages/dashboard/FinanceDashboard'),
  'FinanceDashboard'
);
export const FinanceRefundApproval = lazyNamed(
  () => import('../pages/dashboard/FinanceRefundApproval'),
  'FinanceRefundApproval'
);
export const FinanceSettlementManagement = lazyNamed(
  () => import('../pages/dashboard/FinanceSettlementManagement'),
  'FinanceSettlementManagement'
);
export const FinanceFinancialReport = lazyNamed(
  () => import('../pages/dashboard/FinanceFinancialReport'),
  'FinanceFinancialReport'
);
export const FinanceTreasuryPage = lazyNamed(
  () => import('../pages/dashboard/FinanceTreasuryPage'),
  'FinanceTreasuryPage'
);
export const FinanceLedgerPage = lazyNamed(
  () => import('../pages/dashboard/FinanceLedgerPage'),
  'FinanceLedgerPage'
);
export const FinanceAlertsPage = lazyNamed(
  () => import('../pages/dashboard/FinanceAlertsPage'),
  'FinanceAlertsPage'
);

export const FinanceReconciliationPage = lazyNamed(
  () => import('../pages/dashboard/FinanceReconciliationPage'),
  'FinanceReconciliationPage'
);
export const FinanceWalletMonitorPage = lazyNamed(
  () => import('../pages/dashboard/FinanceWalletMonitorPage'),
  'FinanceWalletMonitorPage'
);
export const FinanceLoyaltyPage = lazyNamed(
  () => import('../pages/dashboard/FinanceLoyaltyPage'),
  'FinanceLoyaltyPage'
);
export const FinanceReferralPage = lazyNamed(
  () => import('../pages/dashboard/FinanceReferralPage'),
  'FinanceReferralPage'
);
export const FinanceDepositPage = lazyNamed(
  () => import('../pages/dashboard/FinanceDepositPage'),
  'FinanceDepositPage'
);
export const FinanceWithdrawPage = lazyNamed(
  () => import('../pages/dashboard/FinanceWithdrawPage'),
  'FinanceWithdrawPage'
);

export const OperationsDashboard = lazyNamed(
  () => import('../pages/dashboard/OperationsDashboard'),
  'OperationsDashboard'
);
export const OperationsAlertsPage = lazyNamed(
  () => import('../pages/dashboard/OperationsAlertsPage'),
  'OperationsAlertsPage'
);
export const OperationsLiveTransactionsPage = lazyNamed(
  () => import('../pages/dashboard/OperationsLiveTransactionsPage'),
  'OperationsLiveTransactionsPage'
);
export const OperationsProductManagement = lazyNamed(
  () => import('../pages/dashboard/OperationsProductManagement'),
  'OperationsProductManagement'
);
export const OperationsProviderManagement = lazyNamed(
  () => import('../pages/dashboard/OperationsProviderManagement'),
  'OperationsProviderManagement'
);
export const OperationsServiceMonitoring = lazyNamed(
  () => import('../pages/dashboard/OperationsServiceMonitoring'),
  'OperationsServiceMonitoring'
);
export const OperationsPricingManagement = lazyNamed(
  () => import('../pages/dashboard/OperationsPricingManagement'),
  'OperationsPricingManagement'
);
export const OperationsAgentMarginPage = lazyNamed(
  () => import('../pages/dashboard/OperationsAgentMarginPage'),
  'OperationsAgentMarginPage'
);
export const OperationsProductProviderControl = lazyNamed(
  () => import('../pages/dashboard/OperationsProductProviderControl'),
  'OperationsProductProviderControl'
);
export const OperationsPaymentGatewayControl = lazyNamed(
  () => import('../pages/dashboard/OperationsPaymentGatewayControl'),
  'OperationsPaymentGatewayControl'
);

export const OwnerDashboard = lazyNamed(
  () => import('../pages/dashboard/OwnerDashboard'),
  'OwnerDashboard'
);
export const OwnerCashFlowProjectionPage = lazyNamed(
  () => import('../pages/dashboard/OwnerCashFlowProjectionPage'),
  'OwnerCashFlowProjectionPage'
);
export const OwnerExecutiveAlertsPage = lazyNamed(
  () => import('../pages/dashboard/OwnerExecutiveAlertsPage'),
  'OwnerExecutiveAlertsPage'
);
export const OwnerExecutiveApprovalsPage = lazyNamed(
  () => import('../pages/dashboard/OwnerExecutiveApprovalsPage'),
  'OwnerExecutiveApprovalsPage'
);
export const OwnerAuditCenterPage = lazyNamed(
  () => import('../pages/dashboard/OwnerAuditCenterPage'),
  'OwnerAuditCenterPage'
);
export const SystemSettingsCenter = lazyNamed(
  () => import('../pages/dashboard/SystemSettingsCenter'),
  'SystemSettingsCenter'
);

/** Idle preload helpers for dashboard warm-up */
export function preloadDashboardCore() {
  void import('../pages/dashboard/RiwayatPage');
  void import('../pages/dashboard/PromoDetailPage');
  void import('../config/catalogCategories');
  void import('../pages/dashboard/CustomerChatPage');
}
