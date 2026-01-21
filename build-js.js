const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const { glob } = require('glob');

const jsDir = path.join(__dirname, 'js');
const outputDir = path.join(__dirname, 'dist', 'js');

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Get all JS files
const jsFiles = glob.sync('*.js', { cwd: jsDir });

console.log(`📄 Found ${jsFiles.length} JavaScript files to optimize\n`);

let totalOriginalSize = 0;
let totalOptimizedSize = 0;

// Process each file
(async () => {
  for (const file of jsFiles) {
    const inputPath = path.join(jsDir, file);
    const outputPath = path.join(outputDir, file.replace('.js', '.min.js'));

    try {
      const code = fs.readFileSync(inputPath, 'utf8');
      const originalSize = Buffer.byteLength(code, 'utf8');
      totalOriginalSize += originalSize;

      // Minify with Terser
      const result = await minify(code, {
        compress: {
          drop_console: false, // Keep console for debugging in production
          drop_debugger: true,
          pure_funcs: [], // Don't remove any functions
          passes: 2 // Multiple passes for better optimization
        },
        mangle: {
          reserved: ['$', 'jQuery'] // Don't mangle jQuery
        },
        format: {
          comments: false // Remove comments
        },
        sourceMap: false
      });

      if (result.error) {
        console.error(`❌ Error minifying ${file}:`, result.error);
        continue;
      }

      fs.writeFileSync(outputPath, result.code);
      const optimizedSize = Buffer.byteLength(result.code, 'utf8');
      totalOptimizedSize += optimizedSize;

      const savings = originalSize - optimizedSize;
      const savingsPercent = ((savings / originalSize) * 100).toFixed(2);

      console.log(`✅ ${file}`);
      console.log(`   ${(originalSize / 1024).toFixed(2)} KB → ${(optimizedSize / 1024).toFixed(2)} KB (${savingsPercent}% smaller)`);
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }

  console.log(`\n✨ JavaScript optimization complete!`);
  console.log(`   Total original: ${(totalOriginalSize / 1024).toFixed(2)} KB`);
  console.log(`   Total optimized: ${(totalOptimizedSize / 1024).toFixed(2)} KB`);
  console.log(`   Total savings: ${((totalOriginalSize - totalOptimizedSize) / 1024).toFixed(2)} KB`);
})();
