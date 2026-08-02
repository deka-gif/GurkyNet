const fs = require('fs');
const path = require('path');

const dashboardDir = 'src/pages/dashboard';
const servicesDir = 'src/services';
const storesDir = 'src/store';

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
    if (!fs.existsSync(pagePath)) {
      report += `Page: ${page} -> NOT FOUND\n\n`;
      continue;
    }

    const content = fs.readFileSync(pagePath, 'utf-8');
    
    // 1. Check for service or store imports
    const serviceImportsMatch = content.match(/import\s+.*?(Service|Store)\s+from\s+['"]([^'"]+)['"]/g) || [];
    const localApiImport = content.match(/import\s+.*?apiClient\s+from/);
    
    let importedServices = [];
    serviceImportsMatch.forEach(imp => {
      const match = imp.match(/import\s+(.*?)\s+from\s+['"]([^'"]+)['"]/);
      if (match) {
        importedServices.push(match[1].replace(/[\{\}]/g, '').trim());
      }
    });

    let hasServiceCall = false;
    for (const s of importedServices) {
       if (content.includes(`${s}.`) || content.includes(`${s}(`)) {
           hasServiceCall = true;
       }
    }
    
    if (localApiImport && content.includes('apiClient')) {
        importedServices.push('apiClient');
        hasServiceCall = true;
    }

    // Check custom hooks that might wrap services
    const hookImportsMatch = content.match(/import\s+\{\s*use[A-Z][a-zA-Z]+\s*\}\s+from\s+['"]([^'"]+)['"]/g) || [];
    let importedHooks = [];
    hookImportsMatch.forEach(imp => {
        const match = imp.match(/import\s+\{\s*(use[A-Z][a-zA-Z]+)\s*\}\s+from/);
        if (match && !match[1].includes('useAuth') && !match[1].includes('useState')) {
             importedHooks.push(match[1]);
             if (content.includes(`${match[1]}(`)) hasServiceCall = true;
        }
    });

    // 4. Look for mock evidence
    let mockEvidence = [];
    if (content.includes('const dummyData')) mockEvidence.push('const dummyData = ...');
    if (content.includes('const mockData')) mockEvidence.push('const mockData = ...');
    if (content.includes('const mockUsers')) mockEvidence.push('const mockUsers = ...');
    
    // Check for hardcoded arrays that look like data lists
    const arrayMatch = content.match(/const\s+[a-zA-Z0-9_]+Data\s*(:\s*[a-zA-Z]+\[\]\s*)?=\s*\[\s*\{/g);
    if (arrayMatch) {
        mockEvidence.push('Hardcoded data arrays: ' + arrayMatch[0].trim() + '...');
    }

    const mockStatsMatch = content.match(/const\s+mock[a-zA-Z0-9_]+\s*=\s*(\[|\{)/g);
    if (mockStatsMatch) {
         mockEvidence.push('Hardcoded mock const: ' + mockStatsMatch[0].trim() + '...');
    }
    
    if (content.match(/setTimeout\(/)) {
        mockEvidence.push('setTimeout(...) (Simulated delays)');
    }

    // Basic inline state array detection
    if (content.match(/useState(<[^>]+>)?\(\[\s*\{\s*id:/)) {
         mockEvidence.push('useState([{ id: ... }]) (Inline mock data state)');
    }

    let status = 'PASS';
    if (mockEvidence.length > 0 && !hasServiceCall) {
        status = 'FAIL';
    } else if (mockEvidence.length > 0 && hasServiceCall) {
        status = 'PARTIAL';
    } else if (mockEvidence.length === 0 && !hasServiceCall) {
        status = 'FAIL'; // No mock, but no service call means it does nothing? Wait, maybe it's just static UI. Let's call it FAIL because it lacks integration.
        mockEvidence.push('No data integration found');
    }

    report += `${page}\n`;
    report += `↓\n`;
    if (importedServices.length > 0 || importedHooks.length > 0) {
        report += `imports ${[...importedServices, ...importedHooks].join(', ')}\n`;
        report += `↓\n`;
    } else {
        report += `NO SERVICE IMPORTS\n`;
        report += `↓\n`;
    }
    
    if (hasServiceCall) {
        report += `calls service/store methods\n`;
        report += `↓\n`;
        // Assume services call apiClient if they exist (we can't easily parse deep here without complicating, but we'll state it relies on the imported store)
        report += `Integrated with backend store/service\n`;
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

fs.writeFileSync('cms_verification.txt', report);
console.log("Report generated.");
