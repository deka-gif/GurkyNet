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

for (const [moduleName, pages] of Object.entries(modules)) {
  report += `\n======================================================\n`;
  report += `MODULE: ${moduleName}\n`;
  report += `======================================================\n\n`;

  for (const page of pages) {
    const pagePath = path.join(dashboardDir, page);
    if (!fs.existsSync(pagePath)) continue;

    const content = fs.readFileSync(pagePath, 'utf-8');
    
    // Check for ANY service import from ../../services
    const serviceImportMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]\.\.\/\.\.\/services['"]/);
    
    // Check for Zustand stores
    const storeImportMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]\.\.\/\.\.\/store\/[^'"]+['"]/g) || [];
    
    let importedServices = [];
    if (serviceImportMatch) {
       const imports = serviceImportMatch[1].split(',').map(i => i.trim());
       imports.forEach(i => {
          if (i.includes('Service') || i.includes('service')) importedServices.push(i);
       });
    }

    storeImportMatch.forEach(imp => {
       const match = imp.match(/import\s+\{([^}]+)\}/);
       if (match) {
           const imports = match[1].split(',').map(i => i.trim());
           imports.forEach(i => {
               if (i.includes('use') && i.includes('Store')) importedServices.push(i);
           });
       }
    });

    let hasServiceCall = false;
    for (const s of importedServices) {
       if (content.includes(`${s}.`) || content.includes(`${s}(`)) {
           hasServiceCall = true;
       }
    }

    // 4. Look for mock evidence
    let mockEvidence = [];
    if (content.match(/const\s+mock[a-zA-Z0-9_]+\s*=\s*(?:\[|\{)/i)) mockEvidence.push('Mock data variables (const mockData = ...)');
    if (content.match(/const\s+dummy[a-zA-Z0-9_]+\s*=\s*(?:\[|\{)/i)) mockEvidence.push('Dummy data variables (const dummyData = ...)');
    if (content.match(/setTimeout\(/)) mockEvidence.push('setTimeout (Simulated delays)');
    if (content.match(/useState(<[^>]+>)?\(\[\s*\{\s*id:/)) mockEvidence.push('Inline mock arrays in useState');
    if (content.match(/const\s+[a-zA-Z0-9_]+Data\s*(:\s*[a-zA-Z]+\[\]\s*)?=\s*\[\s*\{/g)) mockEvidence.push('Hardcoded data arrays');

    let status = 'PASS';
    if (mockEvidence.length > 0 && !hasServiceCall) {
        status = 'FAIL';
    } else if (mockEvidence.length > 0 && hasServiceCall) {
        status = 'PARTIAL';
    } else if (mockEvidence.length === 0 && !hasServiceCall) {
        status = 'FAIL';
        mockEvidence.push('No data integration found (fully static UI)');
    }

    report += `PAGE: ${page}\n`;
    report += `↓\n`;
    if (importedServices.length > 0) {
        report += `imports ${importedServices.join(', ')}\n`;
        report += `↓\n`;
        
        if (hasServiceCall) {
            report += `calls ${importedServices[0]} methods\n`;
            report += `↓\n`;
            report += `Integrated with API / Store\n`;
            report += `↓\n`;
        } else {
            report += `DOES NOT EXECUTE imported service\n`;
            report += `↓\n`;
        }
    } else {
        report += `NO SERVICE OR STORE IMPORTS\n`;
        report += `↓\n`;
    }
    
    if (mockEvidence.length > 0) {
        report += `MOCK EVIDENCE:\n`;
        mockEvidence.forEach(e => report += `- ${e}\n`);
        report += `↓\n`;
    }

    report += `STATUS: ${status}\n\n`;
  }
}

fs.writeFileSync('cms_verification_final.txt', report);
console.log("Report generated.");
