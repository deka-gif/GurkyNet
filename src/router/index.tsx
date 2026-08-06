import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { HomePage } from '../pages/public/HomePage';
import { DocsPage } from '../pages/public/DocsPage';
import { StaticPageView } from '../pages/public/StaticPageView';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { NotFoundPage } from '../pages/public/NotFoundPage';
import { UnauthorizedPage } from '../pages/public/UnauthorizedPage';
import { ProtectedRoute } from '../components/ui/ProtectedRoute';
import { GuestRoute } from '../components/ui/GuestRoute';
import { DashboardHomePage } from '../pages/dashboard/DashboardHomePage';
import { WalletPage } from '../pages/dashboard/WalletPage';
import { PulsaPage } from '../pages/dashboard/PulsaPage';
import { PaketDataPage } from '../pages/dashboard/PaketDataPage';
import { TokenPlnPage } from '../pages/dashboard/TokenPlnPage';
import { GamePage } from '../pages/dashboard/GamePage';
import { VoucherDigitalPage } from '../pages/dashboard/VoucherDigitalPage';
import { VoucherInternetPage } from '../pages/dashboard/VoucherInternetPage';
import { TransferPage } from '../pages/dashboard/TransferPage';
import { TelekomunikasiHubPage, TagihanHubPage } from '../pages/dashboard/ServiceHubPages';
import {
  TopUpDigitalPage,
  LanggananDigitalPage,
  InternationalTopUpPage,
  TelcoSmsTeleponPage,
  TelcoMasaAktifPage,
  TelcoAktivasiPerdanaPage,
  TelcoEsimPage,
  TagihanSubPage,
} from '../pages/dashboard/MappedCatalogPages';
import { RiwayatPage } from '../pages/dashboard/RiwayatPage';
import { NotifikasiPage } from '../pages/dashboard/NotifikasiPage';
import {
  AccountHubPage,
  AccountSettingsPage,
  AccountEditPage,
  AccountPinPage,
  AccountSecurityPage,
  AccountWalletPage,
  AccountComplaintsPage,
  AccountComplaintCreatePage,
  AccountComplaintDetailPage,
  AccountHelpPage,
  AccountCmsPage,
} from '../pages/dashboard/account';
import { CustomerSupportDashboard } from '../pages/dashboard/CustomerSupportDashboard';
import { CustomerSupportTickets } from '../pages/dashboard/CustomerSupportTickets';
import { CustomerSupportTicketDetail } from '../pages/dashboard/CustomerSupportTicketDetail';
import { CustomerSupportCustomerProfile } from '../pages/dashboard/CustomerSupportCustomerProfile';
import { CustomerSupportTransactionInvestigation } from '../pages/dashboard/CustomerSupportTransactionInvestigation';
import { CustomerSupportRefundCenter } from '../pages/dashboard/CustomerSupportRefundCenter';
import { CustomerSupportKnowledgeBase } from '../pages/dashboard/CustomerSupportKnowledgeBase';
import { FinanceDashboard } from '../pages/dashboard/FinanceDashboard';
import { FinanceRefundApproval } from '../pages/dashboard/FinanceRefundApproval';
import { FinanceSettlementManagement } from '../pages/dashboard/FinanceSettlementManagement';
import { FinanceFinancialReport } from '../pages/dashboard/FinanceFinancialReport';
import { OperationsDashboard } from '../pages/dashboard/OperationsDashboard';
import { OperationsProductManagement } from '../pages/dashboard/OperationsProductManagement';
import { OperationsProviderManagement } from '../pages/dashboard/OperationsProviderManagement';
import { OperationsServiceMonitoring } from '../pages/dashboard/OperationsServiceMonitoring';
import { OperationsPricingManagement } from '../pages/dashboard/OperationsPricingManagement';
import { OperationsProductProviderControl } from '../pages/dashboard/OperationsProductProviderControl';
import { MarketingDashboard } from '../pages/dashboard/MarketingDashboard';
import { MarketingBannerManagement } from '../pages/dashboard/MarketingBannerManagement';
import { MarketingPromotionManagement } from '../pages/dashboard/MarketingPromotionManagement';
import { MarketingVoucherManagement } from '../pages/dashboard/MarketingVoucherManagement';
import { MarketingAnnouncementCenter } from '../pages/dashboard/MarketingAnnouncementCenter';
import { MarketingWebsiteSettings } from '../pages/dashboard/MarketingWebsiteSettings';
import { MarketingHomepageSections } from '../pages/dashboard/MarketingHomepageSections';
import { MarketingWebsiteMenu } from '../pages/dashboard/MarketingWebsiteMenu';
import { MarketingStaticPages } from '../pages/dashboard/MarketingStaticPages';
import { MarketingMediaLibrary } from '../pages/dashboard/MarketingMediaLibrary';
import { OwnerDashboard } from '../pages/dashboard/OwnerDashboard';
import { SystemSettingsCenter } from '../pages/dashboard/SystemSettingsCenter';

export const router = createBrowserRouter([
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />
  },
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { 
        index: true, 
        element: <HomePage /> 
      },
      {
        path: 'docs',
        element: <DocsPage />
      },
      {
        path: 'page/:slug',
        element: <StaticPageView />
      }
    ],
  },
  {
    element: (
      <GuestRoute>
        <AuthLayout />
      </GuestRoute>
    ),
    children: [
      {
        path: 'login',
        element: <LoginPage />
      },
      {
        path: 'register',
        element: <RegisterPage />
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordPage />
      },
      {
        path: 'reset-password',
        element: <ForgotPasswordPage />
      }
    ]
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { 
        index: true, 
        element: <DashboardHomePage />
      },
      {
        path: 'owner',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Owner']}>
            <OwnerDashboard />
          </ProtectedRoute>
        )
      },
      {
        path: 'owner/system-settings',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Owner']}>
            <SystemSettingsCenter />
          </ProtectedRoute>
        )
      },
      {
        path: 'finance',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Finance', 'Owner']}>
            <FinanceDashboard />
          </ProtectedRoute>
        )
      },
      {
        path: 'finance/refund-approval',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Finance', 'Owner']}>
            <FinanceRefundApproval />
          </ProtectedRoute>
        )
      },
      {
        path: 'finance/settlement',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Finance', 'Owner']}>
            <FinanceSettlementManagement />
          </ProtectedRoute>
        )
      },
      {
        path: 'finance/financial-report',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Finance', 'Owner']}>
            <FinanceFinancialReport />
          </ProtectedRoute>
        )
      },
      {
        path: 'operations',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Operations', 'Owner']}>
            <OperationsDashboard />
          </ProtectedRoute>
        )
      },
      {
        path: 'operations/products',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Operations', 'Owner']}>
            <OperationsProductManagement />
          </ProtectedRoute>
        )
      },
      {
        path: 'operations/product-providers',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Operations', 'Owner']}>
            <OperationsProductProviderControl />
          </ProtectedRoute>
        )
      },
      {
        path: 'operations/providers',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Operations', 'Owner']}>
            <OperationsProviderManagement />
          </ProtectedRoute>
        )
      },
      {
        path: 'operations/monitoring',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Operations', 'Owner']}>
            <OperationsServiceMonitoring />
          </ProtectedRoute>
        )
      },
      {
        path: 'operations/pricing',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Operations', 'Owner']}>
            <OperationsPricingManagement />
          </ProtectedRoute>
        )
      },
      {
        path: 'marketing',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Marketing', 'Owner']}>
            <MarketingDashboard />
          </ProtectedRoute>
        )
      },
      {
        path: 'marketing/banners',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Marketing', 'Owner']}>
            <MarketingBannerManagement />
          </ProtectedRoute>
        )
      },
      {
        path: 'marketing/promotions',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Marketing', 'Owner']}>
            <MarketingPromotionManagement />
          </ProtectedRoute>
        )
      },
      {
        path: 'marketing/vouchers',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Marketing', 'Owner']}>
            <MarketingVoucherManagement />
          </ProtectedRoute>
        )
      },
      {
        path: 'marketing/announcements',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Marketing', 'Owner']}>
            <MarketingAnnouncementCenter />
          </ProtectedRoute>
        )
      },
      {
        path: 'marketing/website/settings',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Marketing', 'Owner']}>
            <MarketingWebsiteSettings />
          </ProtectedRoute>
        )
      },
      {
        path: 'marketing/website/homepage-sections',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Marketing', 'Owner']}>
            <MarketingHomepageSections />
          </ProtectedRoute>
        )
      },
      {
        path: 'marketing/website/menus',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Marketing', 'Owner']}>
            <MarketingWebsiteMenu />
          </ProtectedRoute>
        )
      },
      {
        path: 'marketing/website/static-pages',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Marketing', 'Owner']}>
            <MarketingStaticPages />
          </ProtectedRoute>
        )
      },
      {
        path: 'marketing/website/media-library',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Marketing', 'Owner']}>
            <MarketingMediaLibrary />
          </ProtectedRoute>
        )
      },

      {
        path: 'wallet',
        element: <WalletPage />
      },
      {
        path: 'topup',
        element: <WalletPage defaultTab="topup" />
      },
      {
        path: 'telekomunikasi',
        element: <TelekomunikasiHubPage />
      },
      {
        path: 'telekomunikasi/sms-telepon',
        element: <TelcoSmsTeleponPage />
      },
      {
        path: 'telekomunikasi/masa-aktif',
        element: <TelcoMasaAktifPage />
      },
      {
        path: 'telekomunikasi/aktivasi-perdana',
        element: <TelcoAktivasiPerdanaPage />
      },
      {
        path: 'telekomunikasi/esim',
        element: <TelcoEsimPage />
      },
      {
        path: 'pulsa',
        element: <PulsaPage />
      },
      {
        path: 'paket-data',
        element: <PaketDataPage />
      },
      {
        path: 'token-pln',
        element: <TokenPlnPage />
      },
      {
        path: 'voucher',
        element: <Navigate to="/dashboard/voucher-digital" replace />
      },
      {
        path: 'voucher-digital',
        element: <VoucherDigitalPage />
      },
      {
        path: 'voucher-internet',
        element: <VoucherInternetPage />
      },
      {
        path: 'ewallet',
        element: <Navigate to="/dashboard/topup-digital" replace />
      },
      {
        path: 'topup-digital',
        element: <TopUpDigitalPage />
      },
      {
        path: 'langganan-digital',
        element: <LanggananDigitalPage />
      },
      {
        path: 'international',
        element: <InternationalTopUpPage />
      },
      {
        path: 'game',
        element: <GamePage />
      },
      {
        path: 'transfer',
        element: <TransferPage />
      },
      {
        path: 'tagihan',
        element: <TagihanHubPage />
      },
      {
        path: 'tagihan/pln-pascabayar',
        element: (
          <TagihanSubPage
            category="pln-pascabayar"
            title="PLN Pascabayar"
            subtitle="Bayar tagihan listrik pascabayar dari katalog provider."
            path="/dashboard/tagihan/pln-pascabayar"
          />
        ),
      },
      {
        path: 'tagihan/pdam',
        element: (
          <TagihanSubPage
            category="pdam"
            title="PDAM"
            subtitle="Bayar tagihan air PDAM dari katalog provider."
            path="/dashboard/tagihan/pdam"
          />
        ),
      },
      {
        path: 'tagihan/bpjs-kesehatan',
        element: (
          <TagihanSubPage
            category="bpjs-kesehatan"
            title="BPJS Kesehatan"
            subtitle="Bayar iuran BPJS Kesehatan dari katalog provider."
            path="/dashboard/tagihan/bpjs-kesehatan"
          />
        ),
      },
      {
        path: 'tagihan/bpjs-tk',
        element: (
          <TagihanSubPage
            category="bpjs-tk"
            title="BPJS Ketenagakerjaan"
            subtitle="Bayar iuran BPJS Ketenagakerjaan dari katalog provider."
            path="/dashboard/tagihan/bpjs-tk"
          />
        ),
      },
      {
        path: 'tagihan/internet',
        element: (
          <TagihanSubPage
            category="internet-pascabayar"
            title="Internet Pascabayar"
            subtitle="Bayar internet pascabayar dari katalog provider."
            path="/dashboard/tagihan/internet"
          />
        ),
      },
      {
        path: 'tagihan/tv',
        element: (
          <TagihanSubPage
            category="tv-pascabayar"
            title="TV Pascabayar"
            subtitle="Bayar TV kabel/satelit dari katalog provider."
            path="/dashboard/tagihan/tv"
          />
        ),
      },
      {
        path: 'tagihan/gas',
        element: (
          <TagihanSubPage
            category="gas"
            title="Gas Negara"
            subtitle="Bayar gas negara / PGN dari katalog provider."
            path="/dashboard/tagihan/gas"
          />
        ),
      },
      {
        path: 'tagihan/pbb',
        element: (
          <TagihanSubPage
            category="pbb"
            title="PBB"
            subtitle="Pilih wilayah, cek pajak ke provider, lalu bayar PBB."
            path="/dashboard/tagihan/pbb"
          />
        ),
      },
      {
        path: 'tagihan/samsat',
        element: (
          <TagihanSubPage
            category="samsat"
            title="SAMSAT"
            subtitle="Pilih wilayah, cek pajak kendaraan ke provider, lalu bayar."
            path="/dashboard/tagihan/samsat"
          />
        ),
      },
      {
        path: 'tagihan/multifinance',
        element: (
          <TagihanSubPage
            category="multifinance"
            title="Multifinance"
            subtitle="Bayar angsuran multifinance dari katalog provider."
            path="/dashboard/tagihan/multifinance"
          />
        ),
      },
      {
        path: 'tagihan/lainnya',
        element: (
          <TagihanSubPage
            category="tagihan"
            title="Tagihan Lainnya"
            subtitle="Katalog tagihan umum dari provider."
            path="/dashboard/tagihan/lainnya"
          />
        ),
      },
      {
        path: 'riwayat',
        element: <RiwayatPage />
      },
      {
        path: 'notifikasi',
        element: <NotifikasiPage />
      },
      {
        path: 'profil',
        element: <Navigate to="/dashboard/account" replace />
      },
      {
        path: 'account',
        element: <AccountHubPage />
      },
      {
        path: 'account/settings',
        element: <AccountSettingsPage />
      },
      {
        path: 'account/edit',
        element: <AccountEditPage />
      },
      {
        path: 'account/security',
        element: <AccountSecurityPage />
      },
      {
        path: 'account/wallet',
        element: <AccountWalletPage />
      },
      {
        path: 'account/pin/create',
        element: <AccountPinPage mode="create" />
      },
      {
        path: 'account/pin/change',
        element: <AccountPinPage mode="change" />
      },
      {
        path: 'account/pin/forgot',
        element: <AccountPinPage mode="forgot" />
      },
      {
        path: 'account/complaints',
        element: <AccountComplaintsPage />
      },
      {
        path: 'account/complaints/new',
        element: <AccountComplaintCreatePage />
      },
      {
        path: 'account/complaints/:id',
        element: <AccountComplaintDetailPage />
      },
      {
        path: 'account/help',
        element: <AccountHelpPage />
      },
      {
        path: 'account/privacy',
        element: <AccountCmsPage kind="privacy" />
      },
      {
        path: 'account/terms',
        element: <AccountCmsPage kind="terms" />
      },
      {
        path: 'account/about',
        element: <AccountCmsPage kind="about" />
      },
      {
        path: 'customer-support',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Customer Support', 'Owner']}>
            <CustomerSupportDashboard />
          </ProtectedRoute>
        )
      },
      {
        path: 'customer-support/tickets',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Customer Support', 'Owner']}>
            <CustomerSupportTickets />
          </ProtectedRoute>
        )
      },
      {
        path: 'customer-support/tickets/:id',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Customer Support', 'Owner']}>
            <CustomerSupportTicketDetail />
          </ProtectedRoute>
        )
      },
      {
        path: 'customer-support/ticket-detail',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Customer Support', 'Owner']}>
            <CustomerSupportTicketDetail />
          </ProtectedRoute>
        )
      },
      {
        path: 'customer-support/customer-profile',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Customer Support', 'Owner']}>
            <CustomerSupportCustomerProfile />
          </ProtectedRoute>
        )
      },
      {
        path: 'customer-support/customers/:userId',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Customer Support', 'Owner']}>
            <CustomerSupportCustomerProfile />
          </ProtectedRoute>
        )
      },
      {
        path: 'customer-support/investigation',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Customer Support', 'Owner']}>
            <CustomerSupportTransactionInvestigation />
          </ProtectedRoute>
        )
      },
      {
        path: 'customer-support/refund-center',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Customer Support', 'Owner']}>
            <CustomerSupportRefundCenter />
          </ProtectedRoute>
        )
      },
      {
        path: 'customer-support/knowledge-base',
        element: (
          <ProtectedRoute allowedRoles={['Super Admin', 'Customer Support', 'Owner']}>
            <CustomerSupportKnowledgeBase />
          </ProtectedRoute>
        )
      }
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
]);
