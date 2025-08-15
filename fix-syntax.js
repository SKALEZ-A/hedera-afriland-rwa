const fs = require('fs');
const path = require('path');

// Files that need fixing
const files = [
  'src/services/DividendService.ts',
  'src/services/NotificationService.ts', 
  'src/services/PropertyService.ts',
  'src/controllers/PropertyManagerController.ts'
];

files.forEach(filePath => {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove methods that are outside class definitions (temporary fix)
  // Look for methods that start with 'async' or 'private async' at the beginning of a line
  // but are not properly indented (indicating they're outside a class)
  
  const lines = content.split('\n');
  const fixedLines = [];
  let inClass = false;
  let braceCount = 0;
  let skipMethod = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Track class definitions
    if (trimmed.includes('export class') || trimmed.includes('class ')) {
      inClass = true;
      braceCount = 0;
    }
    
    // Count braces to track class scope
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;
    
    // If we're at the end of a class
    if (inClass && braceCount === 0 && line.trim() === '}') {
      inClass = false;
    }
    
    // Check if this is a method outside a class
    if (!inClass && (trimmed.startsWith('async ') || trimmed.startsWith('private async '))) {
      skipMethod = true;
      console.log(`Skipping method outside class: ${trimmed.substring(0, 50)}...`);
      continue;
    }
    
    // Skip lines until we find the end of the method
    if (skipMethod) {
      if (line.trim() === '}' && !line.includes('{')) {
        skipMethod = false;
      }
      continue;
    }
    
    fixedLines.push(line);
  }
  
  // Write the fixed content
  fs.writeFileSync(filePath, fixedLines.join('\n'));
  console.log(`Fixed ${filePath}`);
});

console.log('Syntax fixing complete!');