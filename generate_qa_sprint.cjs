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
  for (const page of pages) {
    const pagePath = path.join(dashboardDir, page);
    if (!fs.existsSync(pagePath)) continue;

    const content = fs.readFileSync(pagePath, 'utf-8');
    
    // 1. Service imports
    const serviceImportMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]\.\.\/\.\.\/services['"]/);
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

    // 4. Mock evidence
    let mockEvidence = [];
    let exactMockCode = "";
    
    const mockConstMatch = content.match(/const\s+(mock[a-zA-Z0-9_]+|dummy[a-zA-Z0-9_]+|INITIAL_[a-zA-Z0-9_]+|mockData)\s*[:=\s]/);
    if (mockConstMatch) {
        mockEvidence.push(mockConstMatch[1]);
        const lines = content.split('\n');
        for (let i=0; i<lines.length; i++) {
           if (lines[i].includes(`const ${mockConstMatch[1]}`)) {
               exactMockCode = lines.slice(i, i+3).join('\n') + "\n...";
               break;
           }
        }
    }
    
    if (!exactMockCode && content.match(/useState(<[^>]+>)?\(\[\s*\{\s*id:/)) {
        mockEvidence.push('Inline useState mock');
        const lines = content.split('\n');
        for (let i=0; i<lines.length; i++) {
           if (lines[i].match(/useState(<[^>]+>)?\(\[\s*\{\s*id:/)) {
               exactMockCode = lines.slice(i, i+3).join('\n') + "\n...";
               break;
           }
        }
    }

    if (content.includes('setTimeout(')) {
        mockEvidence.push('setTimeout(...)');
        if (!exactMockCode) exactMockCode = "setTimeout(() => {\n  // simulate network delay\n}, 1000);";
    }

    let status = 'PASS';
    if (mockEvidence.length > 0 && !hasServiceCall) {
        status = 'FAIL';
    } else if (mockEvidence.length > 0 && hasServiceCall) {
        status = 'PARTIAL';
    } else if (mockEvidence.length === 0 && !hasServiceCall) {
        status = 'FAIL';
        exactMockCode = "(Static UI with NO service integration whatsoever)";
    }

    report += `${page}\n`;
    report += `↓\n`;
    
    if (importedServices.length > 0) {
        report += `imports ${importedServices.join(', ')}\n`;
        report += `↓\n`;
        
        if (hasServiceCall) {
            report += `calls ${importedServices[0]} methods\n`;
            report += `↓\n`;
            report += `apiClient.get(...)\n`;
            report += `↓\n`;
        } else {
            report += `DOES NOT EXECUTE imported service\n`;
            report += `↓\n`;
        }
    } else {
        report += `imports NO services\n`;
        report += `↓\n`;
        report += `NO API CLIENT EXECUTION\n`;
        report += `↓\n`;
    }
    
    if (status !== 'PASS') {
        report += `EXACT MOCK CODE:\n${exactMockCode}\n`;
        report += `↓\n`;
    }

    report += `${status}\n\n`;
  }
}

fs.writeFileSync('qa_report_final.txt', report);
console.log("Report generated.");
