#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const reviewDir = process.argv[2] || './ai-review-results';

if (!fs.existsSync(reviewDir)) {
  console.error(`Review directory not found: ${reviewDir}`);
  process.exit(1);
}

const reviewFiles = fs.readdirSync(reviewDir)
  .filter(f => f.endsWith('.json') || f.endsWith('.md'))
  .map(f => path.join(reviewDir, f));

if (reviewFiles.length === 0) {
  console.log(JSON.stringify({
    totalIssues: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    needsFix: false,
    criticalIssues: []
  }));
  process.exit(0);
}

const allIssues = [];
const issuesByFile = new Map();
const issuesBySeverity = { critical: [], high: [], medium: [], low: [] };

reviewFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    
    if (file.endsWith('.json')) {
      const data = JSON.parse(content);
      const issues = data.issues || data.findings || [];
      issues.forEach(issue => processIssue(issue));
    }
    
    if (file.endsWith('.md')) {
      const severityPattern = /\*\*Severity:\*\*\s*(Critical|High|Medium|Low)/gi;
      let match;
      
      while ((match = severityPattern.exec(content)) !== null) {
        const severity = match[1].toLowerCase();
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(content.length, match.index + 500);
        const context = content.substring(contextStart, contextEnd);
        
        const fileMatch = context.match(/File:\s*`([^`]+)`/);
        const categoryMatch = context.match(/Category:\s*([^\n]+)/);
        const lineMatch = context.match(/Line:\s*(\d+)/);
        
        const issue = {
          severity,
          file: fileMatch ? fileMatch[1] : 'unknown',
          category: categoryMatch ? categoryMatch[1].trim() : 'general',
          line: lineMatch ? parseInt(lineMatch[1]) : null,
          description: context.substring(0, 200)
        };
        
        processIssue(issue);
      }
    }
  } catch (e) {
    console.error(`Failed to parse ${file}: ${e.message}`);
  }
});

function processIssue(issue) {
  allIssues.push(issue);
  
  const fileName = issue.file || 'unknown';
  if (!issuesByFile.has(fileName)) {
    issuesByFile.set(fileName, []);
  }
  issuesByFile.get(fileName).push(issue);
  
  const severity = (issue.severity || 'low').toLowerCase();
  if (issuesBySeverity[severity]) {
    issuesBySeverity[severity].push(issue);
  }
}

const analysis = {
  totalIssues: allIssues.length,
  bySeverity: {
    critical: issuesBySeverity.critical.length,
    high: issuesBySeverity.high.length,
    medium: issuesBySeverity.medium.length,
    low: issuesBySeverity.low.length
  },
  criticalIssues: issuesBySeverity.critical.concat(issuesBySeverity.high),
  needsFix: issuesBySeverity.critical.length > 0 || issuesBySeverity.high.length > 0,
  issuesByFile: Object.fromEntries(
    Array.from(issuesByFile.entries()).map(([file, issues]) => [
      file,
      {
        count: issues.length,
        critical: issues.filter(i => i.severity === 'critical').length,
        high: issues.filter(i => i.severity === 'high').length
      }
    ])
  )
};

console.log(JSON.stringify(analysis, null, 2));

if (analysis.needsFix) {
  const fixInstructions = analysis.criticalIssues.map((issue, idx) => {
    return `${idx + 1}. [${(issue.severity || 'unknown').toUpperCase()}] ${issue.file}:${issue.line || 'N/A'}
   Category: ${issue.category || 'general'}
   Issue: ${issue.description || issue.message || 'No description'}
   ${issue.suggestion ? `Suggestion: ${issue.suggestion}` : ''}
`;
  }).join('\n');
  
  fs.writeFileSync(
    path.join(reviewDir, 'fix-instructions.txt'),
    `Critical and High Severity Issues:\n\n${fixInstructions}`
  );
}

process.exit(analysis.needsFix ? 1 : 0);
