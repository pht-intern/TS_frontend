const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputFile = path.join(__dirname, 'css', 'style.css');
const outputDir = path.join(__dirname, 'dist', 'css');
const outputFile = path.join(outputDir, 'style.min.css');

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Get original file size
const originalSize = fs.statSync(inputFile).size;
console.log(`📄 Original CSS size: ${(originalSize / 1024).toFixed(2)} KB`);

// Run PostCSS with PurgeCSS
console.log('🔍 Analyzing HTML files for used CSS...');
try {
  execSync(`npx postcss "${inputFile}" -o "${outputFile}"`, {
    stdio: 'inherit',
    cwd: __dirname
  });

  // Get optimized file size
  const optimizedSize = fs.statSync(outputFile).size;
  const savings = originalSize - optimizedSize;
  const savingsPercent = ((savings / originalSize) * 100).toFixed(2);

  console.log(`\n✅ CSS optimization complete!`);
  console.log(`   Original: ${(originalSize / 1024).toFixed(2)} KB`);
  console.log(`   Optimized: ${(optimizedSize / 1024).toFixed(2)} KB`);
  console.log(`   Savings: ${(savings / 1024).toFixed(2)} KB (${savingsPercent}%)`);
} catch (error) {
  console.error('❌ CSS build failed:', error.message);
  process.exit(1);
}
