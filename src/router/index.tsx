import { createBrowserRouter } from 'react-router-dom';
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
import { VoucherPage } from '../pages/dashboard/VoucherPage';
import { TransferPage } from '../pages/dashboard/TransferPage';
import { TagihanPage } from '../pages/dashboard/TagihanPage';
import { RiwayatPage } from '../pages/dashboard/RiwayatPage';
import { NotifikasiPage } from '../pages/dashboard/NotifikasiPage';
import { ProfilPage } from '../pages/dashboard/ProfilPage';
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
        element: <VoucherPage />
      },
      {
        path: 'transfer',
        element: <TransferPage />
      },
      {
        path: 'tagihan',
        element: <TagihanPage />
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
        element: <ProfilPage />
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
