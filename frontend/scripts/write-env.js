const fs = require('fs');
const path = require('path');

const apiUrl = (process.env.API_URL || process.env.TODOFLOW_API_URL || '').trim();
const outputPath = path.join(__dirname, '..', 'env.js');

const content = `window.TODOFLOW_CONFIG = {
  API_URL: ${JSON.stringify(apiUrl)}
};
`;

fs.writeFileSync(outputPath, content, 'utf8');
console.log(`Frontend API_URL configured: ${apiUrl || '(same-origin/local fallback)'}`);
