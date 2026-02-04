/**
 * Script to create a multi-resolution Windows ICO file from PNG assets
 * Windows requires ICO files with embedded sizes: 16x16, 32x32, 48x48, 256x256
 */

const fs = require('fs');
const path = require('path');

// Check if we have the required dependencies
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Error: sharp package is required but not installed.');
  console.log('📦 Please install it: npm install --save-dev sharp');
  process.exit(1);
}

async function createWindowsIcon() {
  const assetsDir = path.join(__dirname, '..', 'public', 'assets');
  const buildDir = path.join(__dirname, '..', 'build');
  const outputIco = path.join(buildDir, 'icon.ico');

  // Ensure build directory exists
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
    console.log(`📁 Created build directory: ${buildDir}`);
  }

  // Required sizes for Windows ICO - NSIS installer needs these exact sizes
  const requiredSizes = [16, 32, 48, 256];
  
  // Preferred PNG files with exact sizes (priority order)
  const sourceFiles = {
    16: [
      path.join(assetsDir, 'icon-16x16.png'),      // Preferred: exact size
      path.join(assetsDir, 'favicon-16x16.png')    // Fallback: existing file
    ],
    32: [
      path.join(assetsDir, 'icon-32x32.png'),      // Preferred: exact size
      path.join(assetsDir, 'favicon-32x32.png')    // Fallback: existing file
    ],
    48: [
      path.join(assetsDir, 'icon-48x48.png'),      // Preferred: exact size
      path.join(assetsDir, 'ms-icon-70x70.png')    // Fallback: resize 70x70
    ],
    256: [
      path.join(assetsDir, 'icon-256x256.png'),    // Preferred: exact size
      path.join(assetsDir, 'ms-icon-310x310.png'), // Fallback: resize 310x310
      path.join(assetsDir, 'ms-icon-150x150.png')  // Fallback: resize 150x150
    ]
  };

  // Fallback to icon.png if specific sizes not found
  const fallback = path.join(assetsDir, 'icon.png');

  console.log('🎨 Creating Windows ICO file with multiple resolutions...\n');

  // Create images array for ICO
  const images = [];

  for (const size of requiredSizes) {
    let sourceFile = null;
    const candidates = sourceFiles[size];
    
    // Try each candidate file in order
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        sourceFile = candidate;
        break;
      }
    }
    
    // If no candidate found, try fallback
    if (!sourceFile) {
      if (fs.existsSync(fallback)) {
        console.log(`⚠️  ${size}x${size}: Using fallback (${path.basename(fallback)})`);
        sourceFile = fallback;
      } else {
        console.error(`❌ Error: Could not find source image for ${size}x${size}`);
        console.error(`   Tried: ${candidates.map(f => path.basename(f)).join(', ')}`);
        console.error(`   Fallback: ${path.basename(fallback)}`);
        process.exit(1);
      }
    } else {
      console.log(`✓ ${size}x${size}: Using ${path.basename(sourceFile)}`);
    }

    let image;
    try {
      // Load image and ensure it's exactly the right size
      const metadata = await sharp(sourceFile).metadata();
      
      // If image is already the right size, use it directly
      if (metadata.width === size && metadata.height === size) {
        image = await sharp(sourceFile)
          .ensureAlpha()
          .png()
          .toBuffer();
      } else {
        // Resize to exact size with proper settings
        image = await sharp(sourceFile)
          .resize(size, size, {
            fit: 'cover',  // Changed from 'contain' to 'cover' to fill the entire size
            position: 'center',
            background: { r: 255, g: 255, b: 255, alpha: 0 }  // Transparent background
          })
          .ensureAlpha()
          .png()
          .toBuffer();
      }

      images.push(image);
    } catch (error) {
      console.error(`❌ Error processing ${size}x${size}:`, error.message);
      process.exit(1);
    }
  }

  // Create ICO file
  // Note: sharp doesn't directly create ICO files, so we'll use to-ico if available
  try {
    // Ensure build directory exists right before writing (double-check)
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
      console.log(`📁 Created build directory: ${buildDir}`);
    }
    
    const toIco = require('to-ico');
    
    // Convert PNG buffers to ICO - to-ico expects array of buffers
    const icoBuffer = await toIco(images);
    
    // Write ICO file
    fs.writeFileSync(outputIco, icoBuffer);
    
    console.log(`\n✅ Successfully created: ${outputIco}`);
    console.log(`   Embedded sizes: ${requiredSizes.join('x, ')}x pixels`);
    console.log(`   File size: ${(icoBuffer.length / 1024).toFixed(2)} KB\n`);
  } catch (error) {
    console.error('❌ Error creating ICO file:', error.message);
    console.error('   Stack:', error.stack);
    console.log('\n💡 Alternative: Use an online tool like:');
    console.log('   https://convertio.co/png-ico/');
    console.log('   https://www.icoconverter.com/');
    console.log('\n   Upload your PNG files and select sizes: 16x16, 32x32, 48x48, 256x256');
    process.exit(1);
  }
}

// Run the script
createWindowsIcon().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

