const fs = require('fs');
const path = require('path');

const dashboardDir = 'src/pages/dashboard';
const storeDir = 'src/store';
const serviceDir = 'src/services';

const files = fs.readdirSync(dashboardDir).filter(f => f.endsWith('.tsx'));

const modules = {
  Finance: ['FinanceDashboard.tsx', 'FinanceFinancialReport.tsx', 'FinanceRefundApproval.tsx', 'FinanceSettlementManagement.tsx'],
  Operations: ['OperationsDashboard.tsx', 'OperationsPricingManagement.tsx', 'OperationsProductManagement.tsx', 'OperationsProviderManagement.tsx', 'OperationsServiceMonitoring.tsx'],
  Marketing: ['MarketingDashboard.tsx', 'MarketingVoucherManagement.tsx', 'MarketingAnnouncementCenter.tsx', 'MarketingBannerManagement.tsx', 'MarketingPromotionManagement.tsx'],
  CustomerSupport: ['CustomerSupportDashboard.tsx', 'CustomerSupportCustomerProfile.tsx', 'CustomerSupportKnowledgeBase.tsx', 'CustomerSupportRefundCenter.tsx', 'CustomerSupportTicketDetail.tsx', 'CustomerSupportTickets.tsx', 'CustomerSupportTransactionInvestigation.tsx'],
  Owner: ['OwnerDashboard.tsx'],
  SystemSettings: ['SystemSettingsCenter.tsx'],
  WebsiteCMS: ['MarketingWebsiteSettings.tsx', 'MarketingHomepageSections.tsx', 'MarketingWebsiteMenu.tsx', 'MarketingStaticPages.tsx', 'MarketingMediaLibrary.tsx']
};

let report = "";

for (const [moduleName, fileList] of Object.entries(modules)) {
  report += `\n# Module: ${moduleName}\n\n`;
  
  for (const file of fileList) {
    const filePath = path.join(dashboardDir, file);
    if (!fs.existsSync(filePath)) continue;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    let dummyData = [];
    let hasLocalState = false;
    let hasHardcodedArrays = false;
    let mockServices = false;

    // Detect mock variables
    if (content.includes('const mock') || content.includes('const dummy') || content.includes('Dummy')) {
        dummyData.push('Mock variables or dummy data declarations found');
        hasHardcodedArrays = true;
    }
    
    // Detect inline mock array state
    if (content.match(/useState(<.*>)?\(\s*\[\s*\{/)) {
        dummyData.push('Inline mock array state found');
        hasLocalState = true;
        hasHardcodedArrays = true;
    }

    // Detect if they are using any real service/store
    const usesStore = content.includes('useStore') || content.includes('useWalletStore') || content.includes('useTransactionStore') || content.includes('useProductStore') || content.includes('useBannerStore') || content.includes('useMediaStore') || content.includes('useWebsiteStore');
    const usesApi = content.includes('apiClient') || content.includes('axios');
    
    if (!usesStore && !usesApi) {
        mockServices = true;
    }

    let status = 'PASS';
    if (dummyData.length > 0 || mockServices) {
        status = 'FAIL';
    }

    report += `## Page: ${file.replace('.tsx', '')}\n`;
    report += `Status: ${status}\n`;
    report += `Affected files: ${filePath}\n`;
    
    if (status === 'FAIL') {
      report += `Expected behavior: Should fetch data from backend API (with proper CRUD, filtering, pagination, and error handling) and use centralized Zustand stores.\n`;
      report += `Actual behavior: Relies on local mock data, hardcoded arrays, or lacks real API integration.\n`;
      report += `Remaining dummy data: ${dummyData.length > 0 ? dummyData.join(', ') : 'None explicitly detected, but missing real API usage'}\n`;
      report += `Remaining local state: ${hasLocalState || mockServices ? 'Yes (for primary entity data)' : 'No'}\n`;
      report += `Remaining mock services: ${mockServices ? 'Yes' : 'No'}\n`;
      report += `Remaining hardcoded arrays: ${hasHardcodedArrays ? 'Yes' : 'No'}\n`;
    } else {
       report += `Expected behavior: Full CRUD/API integration.\n`;
       report += `Actual behavior: Uses external stores or API clients. No explicit mock arrays detected.\n`;
       report += `Remaining dummy data: None detected.\n`;
       report += `Remaining local state: Clean.\n`;
       report += `Remaining mock services: Clean.\n`;
       report += `Remaining hardcoded arrays: Clean.\n`;
    }
    report += `\n`;
  }
}

console.log(report);
