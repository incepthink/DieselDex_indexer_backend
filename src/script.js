import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createAssetIdMap() {
  try {
    // Path to your array output file - update this to your actual path
    const inputFilePath = path.join(__dirname, 'output', 'db_array_2025-02-28T11-23-28-658Z.json');
    
    // Read the array data
    const rawData = fs.readFileSync(inputFilePath, 'utf8');
    const assetsArray = JSON.parse(rawData);
    
    console.log(`Processing ${assetsArray.length} asset records...`);
    
    // Create a map with asset_id as the key
    const assetMap = {};
    
    assetsArray.forEach(asset => {
      if (asset.asset_id) {
        assetMap[asset.asset_id] = asset;
      } else {
        console.warn('Found asset without asset_id:', asset);
      }
    });
    
    // Count the number of assets in the map
    const mapSize = Object.keys(assetMap).length;
    console.log(`Created map with ${mapSize} assets`);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    // Save to a new file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilePath = path.join(outputDir, `assets_by_id_${timestamp}.json`);
    
    fs.writeFileSync(
      outputFilePath,
      JSON.stringify(assetMap, null, 2),
      'utf8'
    );
    
    console.log(`Asset map successfully saved to: ${outputFilePath}`);
    
    return assetMap;
  } catch (error) {
    console.error('Error creating asset map:', error);
    throw error;
  }
}

// Run the function
createAssetIdMap().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});