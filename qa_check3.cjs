const fs = require('fs');
const path = require('path');

const dashboardDir = 'src/pages/dashboard';

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
  report += `\n### Module: ${moduleName}\n\n`;
  
  for (const file of fileList) {
    const filePath = path.join(dashboardDir, file);
    if (!fs.existsSync(filePath)) {
      report += `**Page: ${file.replace('.tsx', '')}**\n`;
      report += `- Status: FAIL\n`;
      report += `- Affected files: ${filePath} (Not Found)\n\n`;
      continue;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    let dummyData = [];
    let hasLocalState = false;
    let hasHardcodedArrays = false;
    let mockServices = false;

    // Detect mock variables
    if (content.includes('const mock') || content.includes('const dummy') || content.includes('Dummy') || content.includes('mockData')) {
        dummyData.push('Mock variables/dummy data declarations found');
        hasHardcodedArrays = true;
    }
    
    // Detect inline mock array state
    if (content.match(/useState(<.*>)?\(\s*\[\s*\{/)) {
        dummyData.push('Inline mock array state found');
        hasLocalState = true;
        hasHardcodedArrays = true;
    }

    // Advanced search for hardcoded tables
    if (content.match(/const [a-zA-Z]+Data(\s*:\s*[a-zA-Z]+\[\])?\s*=\s*\[\s*\{/)) {
        dummyData.push('Hardcoded array of objects found');
        hasHardcodedArrays = true;
    }

    // Detect if they are using any real service/store
    const stores = ['useStore', 'useWalletStore', 'useTransactionStore', 'useProductStore', 'useBannerStore', 'useMediaStore', 'useWebsiteStore'];
    const usesStore = stores.some(s => content.includes(s));
    const usesApi = content.includes('apiClient') || content.includes('axios');
    
    if (!usesStore && !usesApi) {
        mockServices = true;
    }

    let status = 'PASS';
    if (dummyData.length > 0 || mockServices || hasHardcodedArrays) {
        status = 'FAIL';
    } else if (!usesApi && !usesStore) {
        status = 'WARNING';
    }

    report += `**Page: ${file.replace('.tsx', '')}**\n`;
    report += `- Status: ${status}\n`;
    report += `- Affected files: ${filePath}\n`;
    report += `- Affected endpoints: ${usesApi || usesStore ? 'Integrated via Store/Service' : 'None (Mocked)'}\n`;
    report += `- Expected behavior: Should fetch data from backend API with proper CRUD, filtering, searching, pagination, export, and error handling (404, 401, 403, 422, 500) via centralized Zustand stores.\n`;
    
    if (status === 'FAIL' || status === 'WARNING') {
      report += `- Actual behavior: Relies on local state, mock data, or lacks real API endpoints.\n`;
      report += `- Remaining dummy data: ${dummyData.length > 0 ? 'Yes (' + dummyData.join(', ') + ')' : 'No'}\n`;
      report += `- Remaining local state: ${hasLocalState || mockServices ? 'Yes (Primary state managed locally)' : 'No'}\n`;
      report += `- Remaining mock services: ${mockServices ? 'Yes' : 'No'}\n`;
      report += `- Remaining hardcoded arrays: ${hasHardcodedArrays ? 'Yes' : 'No'}\n`;
    } else {
       report += `- Actual behavior: Uses external stores/API clients for data management. Clean of mock data.\n`;
       report += `- Remaining dummy data: No\n`;
       report += `- Remaining local state: No\n`;
       report += `- Remaining mock services: No\n`;
       report += `- Remaining hardcoded arrays: No\n`;
    }
    report += `\n`;
  }
}

console.log(report);
