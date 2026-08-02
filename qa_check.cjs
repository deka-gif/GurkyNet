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
    
    let isMock = false;
    let hasLocalState = false;
    let hasHardcodedArrays = false;
    let hasAPI = false;
    let hasPagination = false;
    let dummyData = [];
    
    if (content.includes('useState([') && content.includes('{ id:') || content.includes('mock') || content.includes('dummy')) {
      isMock = true;
      hasLocalState = true;
      hasHardcodedArrays = true;
      dummyData.push('Mock lists/data found');
    }
    
    if (content.includes('axios') || content.includes('apiClient') || content.includes('useStore(') || content.includes('Store')) {
      hasAPI = true;
    }
    
    if (content.includes('const mock') || content.includes('Dummy')) {
        dummyData.push('mock variables found');
    }

    let status = 'PASS';
    if (isMock || hasHardcodedArrays) status = 'FAIL';
    else if (!hasAPI) status = 'WARNING';
    
    report += `## Page: ${file.replace('.tsx', '')}\n`;
    report += `Status: ${status}\n`;
    report += `Affected files: ${filePath}\n`;
    report += `Affected endpoints: ${hasAPI ? 'Integrated via Store/Service' : 'None/Mocked'}\n`;
    
    if (status === 'FAIL') {
      report += `Expected behavior: Should fetch data from API, handle loading, handle pagination and error states.\n`;
      report += `Actual behavior: Uses mock data, hardcoded arrays, and local state management for data.\n`;
      report += `Remaining dummy data: ${dummyData.join(', ')}\n`;
      report += `Remaining local state: true\n`;
      report += `Remaining mock services: true\n`;
      report += `Remaining hardcoded arrays: true\n`;
    } else if (status === 'WARNING') {
      report += `Expected behavior: Should be fully integrated.\n`;
      report += `Actual behavior: Partially integrated or missing API.\n`;
    } else {
       report += `Expected behavior: Normal operations.\n`;
       report += `Actual behavior: Appears to use external stores.\n`;
    }
    report += `\n`;
  }
}

console.log(report);
