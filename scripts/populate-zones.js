#!/usr/bin/env node

/**
 * USDA Hardiness Zone Populator for Shopify Products
 *
 * This script automatically populates USDA hardiness zone metafields
 * for products in your Shopify store based on a botanical database.
 *
 * Usage:
 *   node populate-zones.js              # Run with updates
 *   node populate-zones.js --dry-run    # Preview changes without updating
 *   node populate-zones.js --verbose    # Show detailed logging
 *   node populate-zones.js --normalize  # Convert old "zone-X" format to "X"
 *
 * Prerequisites:
 *   1. Create a .env file with your Shopify credentials
 *   2. npm install dotenv node-fetch
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  shopifyStore: process.env.SHOPIFY_STORE_DOMAIN,
  accessToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
  apiVersion: '2024-10',
  metafieldNamespace: 'custom',
  metafieldKey: 'usda_hardiness_zones',
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  normalize: process.argv.includes('--normalize'),
};

// Load plant zones database
const plantZonesPath = path.join(__dirname, 'plant-zones.json');
let plantDatabase = null;

try {
  const data = fs.readFileSync(plantZonesPath, 'utf8');
  plantDatabase = JSON.parse(data);
  console.log(`✓ Loaded plant database with ${Object.keys(plantDatabase.plants).length} entries\n`);
} catch (error) {
  console.error('✗ Failed to load plant-zones.json:', error.message);
  process.exit(1);
}

// Validate configuration
function validateConfig() {
  const missing = [];
  if (!CONFIG.shopifyStore) missing.push('SHOPIFY_STORE_DOMAIN');
  if (!CONFIG.accessToken) missing.push('SHOPIFY_ADMIN_API_TOKEN');

  if (missing.length > 0) {
    console.error('✗ Missing required environment variables:');
    missing.forEach(v => console.error(`  - ${v}`));
    console.error('\nCreate a .env file with these values. See .env.example for reference.');
    process.exit(1);
  }
}

// GraphQL client for Shopify Admin API
async function shopifyGraphQL(query, variables = {}) {
  const fetch = (await import('node-fetch')).default;

  const url = `https://${CONFIG.shopifyStore}/admin/api/${CONFIG.apiVersion}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': CONFIG.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Fetch all products with pagination
async function fetchAllProducts() {
  const products = [];
  let hasNextPage = true;
  let cursor = null;

  console.log('Fetching products from Shopify...\n');

  while (hasNextPage) {
    const query = `
      query GetProducts($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              handle
              metafields(first: 10, namespace: "${CONFIG.metafieldNamespace}") {
                edges {
                  node {
                    id
                    key
                    value
                    type
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await shopifyGraphQL(query, { cursor });

    for (const edge of data.products.edges) {
      const product = edge.node;
      const zoneMetafield = product.metafields.edges.find(
        m => m.node.key === CONFIG.metafieldKey
      );

      products.push({
        id: product.id,
        title: product.title,
        handle: product.handle,
        existingZones: zoneMetafield ? JSON.parse(zoneMetafield.node.value) : null,
        metafieldId: zoneMetafield ? zoneMetafield.node.id : null,
      });
    }

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;

    process.stdout.write(`  Fetched ${products.length} products...\r`);
  }

  console.log(`✓ Fetched ${products.length} products total\n`);
  return products;
}

// Extract plant name from product title
function extractPlantName(title) {
  // Clean up the title for matching
  let cleanTitle = title.toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove common suffixes that aren't part of the plant name
  const suffixPatterns = [
    /\s*-\s*\d+\s*(gal|gallon|qt|quart|inch|in|ft|feet|pack|ct).*$/i,
    /\s*\(\d+.*?\)$/,
    /\s*\d+\s*(gal|gallon|qt|quart|inch|in|ft|feet|pack|ct).*$/i,
    /\s*bare\s*root.*$/i,
    /\s*potted.*$/i,
    /\s*tree\s*$/i,
    /\s*shrub\s*$/i,
    /\s*plant\s*$/i,
  ];

  for (const pattern of suffixPatterns) {
    cleanTitle = cleanTitle.replace(pattern, '');
  }

  return cleanTitle.trim();
}

// Normalize zone format from "zone-7" to "7"
function normalizeZoneFormat(zones) {
  return zones.map((zone) =>
    zone
      .toLowerCase()
      .replace('zone', '')
      .replace('-', '')
      .replace(' ', '')
      .trim()
  );
}

// Check if zones need normalization (have old "zone-X" format)
function needsNormalization(zones) {
  return zones.some((z) => typeof z === 'string' && z.toLowerCase().includes('zone'));
}

// Look up zones for a plant name
function lookupZones(plantName) {
  const plants = plantDatabase.plants;

  // Direct match
  if (plants[plantName]) {
    return { zones: plants[plantName].zones, matchType: 'exact' };
  }

  // Try partial matches
  const plantKeys = Object.keys(plants);

  // Check if plant name contains a known plant (longer keys first for best match)
  const sortedByLength = [...plantKeys].sort((a, b) => b.length - a.length);
  for (const key of sortedByLength) {
    if (plantName.includes(key) && key.length >= 5) {
      return { zones: plants[key].zones, matchType: 'contains', matchedKey: key };
    }
  }

  // Check if a known plant is contained in the plant name (minimum 6 chars to avoid false positives)
  for (const key of plantKeys) {
    if (key.includes(plantName) && plantName.length >= 6) {
      return { zones: plants[key].zones, matchType: 'partial', matchedKey: key };
    }
  }

  // Conservative word matching - only match on specific botanical terms
  // that are unique identifiers, not generic words like "star", "red", "little"
  const botanicalTerms = [
    'magnolia', 'maple', 'oak', 'pine', 'spruce', 'cedar', 'cypress', 'arborvitae',
    'dogwood', 'redbud', 'cherry', 'crape', 'crepe', 'myrtle', 'birch', 'willow',
    'elm', 'ash', 'tulip', 'ginkgo', 'sweetgum', 'sycamore', 'locust', 'beech',
    'hickory', 'walnut', 'chestnut', 'hazelnut', 'catalpa', 'boxwood', 'holly',
    'privet', 'hydrangea', 'lilac', 'azalea', 'rhododendron', 'camellia', 'gardenia',
    'forsythia', 'hibiscus', 'butterfly', 'spirea', 'viburnum', 'barberry', 'weigela',
    'ninebark', 'juniper', 'yew', 'hemlock', 'fir', 'palm', 'serviceberry', 'fringe',
    'blueberry', 'elderberry', 'beautyberry', 'clethra', 'photinia', 'nandina',
    'loropetalum', 'laurel', 'pieris', 'leucothoe', 'aucuba', 'osmanthus', 'fatsia',
    'podocarpus', 'deutzia', 'kerria', 'potentilla', 'cotoneaster', 'abelia',
    'sweetspire', 'fothergilla', 'snowberry', 'coralberry', 'jasmine', 'lantana',
    'muhly', 'mondo', 'liriope', 'daylily', 'oleander', 'mahonia', 'pittosporum',
    'distylium', 'guava', 'yucca', 'ligustrum', 'dianella', 'agapanthus', 'sage'
  ];

  const words = plantName.split(' ').filter(w => w.length > 4);
  for (const word of words) {
    // Only match if the word is a known botanical term
    if (botanicalTerms.includes(word)) {
      for (const key of sortedByLength) {
        if (key.includes(word)) {
          return { zones: plants[key].zones, matchType: 'botanical', matchedKey: key, matchedWord: word };
        }
      }
    }
  }

  return null;
}

// Update product metafield
async function updateProductZones(product, zones) {
  if (CONFIG.dryRun) {
    return { success: true, dryRun: true };
  }

  const zonesJson = JSON.stringify(zones);

  const mutation = `
    mutation UpdateProductMetafields($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          metafields(first: 5, namespace: "${CONFIG.metafieldNamespace}") {
            edges {
              node {
                key
                value
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      id: product.id,
      metafields: [
        {
          namespace: CONFIG.metafieldNamespace,
          key: CONFIG.metafieldKey,
          type: 'list.single_line_text_field',
          value: zonesJson,
        },
      ],
    },
  };

  const data = await shopifyGraphQL(mutation, variables);

  if (data.productUpdate.userErrors.length > 0) {
    throw new Error(data.productUpdate.userErrors.map(e => e.message).join(', '));
  }

  return { success: true };
}

// Main execution
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  USDA Hardiness Zone Populator for Shopify Products   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (CONFIG.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  if (CONFIG.normalize) {
    console.log('🔄 NORMALIZE MODE - Will convert old zone-X format to plain numbers\n');
  }

  validateConfig();

  const products = await fetchAllProducts();

  const results = {
    updated: [],
    skipped: [],
    notFound: [],
    normalized: [],
    errors: [],
  };

  console.log('Processing products...\n');

  for (const product of products) {
    const plantName = extractPlantName(product.title);
    const lookup = lookupZones(plantName);

    if (CONFIG.verbose) {
      console.log(`\n  "${product.title}"`);
      console.log(`    Extracted: "${plantName}"`);
    }

    // Handle products that already have zones
    if (product.existingZones && product.existingZones.length > 0) {
      // Check if normalization is needed and requested
      if (CONFIG.normalize && needsNormalization(product.existingZones)) {
        const normalizedZones = normalizeZoneFormat(product.existingZones);

        try {
          await updateProductZones(product, normalizedZones);

          results.normalized.push({
            title: product.title,
            oldZones: product.existingZones,
            newZones: normalizedZones,
          });

          if (CONFIG.verbose) {
            console.log(`    🔄 Normalized: ${product.existingZones.join(', ')} → ${normalizedZones.join(', ')}`);
          } else {
            process.stdout.write(`  Normalized: ${results.normalized.length} | Skipped: ${results.skipped.length}\r`);
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 550));
        } catch (error) {
          results.errors.push({
            title: product.title,
            error: error.message,
          });
          if (CONFIG.verbose) {
            console.log(`    ✗ Error normalizing: ${error.message}`);
          }
        }
      } else {
        // Skip - already has zones in correct format (or --normalize not passed)
        results.skipped.push({
          title: product.title,
          reason: 'Already has zones',
          existingZones: product.existingZones,
        });
        if (CONFIG.verbose) {
          console.log(`    ⏭ Skipped (existing zones: ${product.existingZones.join(', ')})`);
        }
      }
      continue;
    }

    if (!lookup) {
      results.notFound.push({
        title: product.title,
        extractedName: plantName,
      });
      if (CONFIG.verbose) {
        console.log(`    ⚠ No zone data found`);
      }
      continue;
    }

    try {
      await updateProductZones(product, lookup.zones);

      results.updated.push({
        title: product.title,
        zones: lookup.zones,
        matchType: lookup.matchType,
        matchedKey: lookup.matchedKey,
      });

      if (CONFIG.verbose) {
        console.log(`    ✓ Updated zones: ${lookup.zones.join(', ')} (${lookup.matchType} match${lookup.matchedKey ? `: "${lookup.matchedKey}"` : ''})`);
      } else {
        process.stdout.write(`  Updated: ${results.updated.length} | Skipped: ${results.skipped.length} | Not Found: ${results.notFound.length}\r`);
      }

      // Rate limiting - Shopify allows 2 requests/second for mutations
      await new Promise(resolve => setTimeout(resolve, 550));

    } catch (error) {
      results.errors.push({
        title: product.title,
        error: error.message,
      });
      if (CONFIG.verbose) {
        console.log(`    ✗ Error: ${error.message}`);
      }
    }
  }

  // Print summary
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('                        SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (CONFIG.dryRun) {
    console.log('🔍 DRY RUN - No actual changes were made\n');
  }

  console.log(`✓ Updated:    ${results.updated.length} products`);
  console.log(`🔄 Normalized: ${results.normalized.length} products (format fixed)`);
  console.log(`⏭ Skipped:    ${results.skipped.length} products (already had zones)`);
  console.log(`⚠ Not Found:  ${results.notFound.length} products (need manual review)`);
  console.log(`✗ Errors:     ${results.errors.length} products\n`);

  // List products needing manual review
  if (results.notFound.length > 0) {
    console.log('───────────────────────────────────────────────────────────');
    console.log('Products needing manual zone assignment:');
    console.log('───────────────────────────────────────────────────────────');
    results.notFound.forEach(p => {
      console.log(`  • ${p.title}`);
      console.log(`    (extracted: "${p.extractedName}")`);
    });
    console.log('');
  }

  // List errors
  if (results.errors.length > 0) {
    console.log('───────────────────────────────────────────────────────────');
    console.log('Products with errors:');
    console.log('───────────────────────────────────────────────────────────');
    results.errors.forEach(p => {
      console.log(`  • ${p.title}`);
      console.log(`    Error: ${p.error}`);
    });
    console.log('');
  }

  // Save detailed report
  const reportPath = path.join(__dirname, 'zone-update-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    dryRun: CONFIG.dryRun,
    summary: {
      total: products.length,
      updated: results.updated.length,
      normalized: results.normalized.length,
      skipped: results.skipped.length,
      notFound: results.notFound.length,
      errors: results.errors.length,
    },
    details: results,
  }, null, 2));

  console.log(`📄 Detailed report saved to: ${reportPath}\n`);
}

// Run the script
main().catch(error => {
  console.error('\n✗ Fatal error:', error.message);
  process.exit(1);
});
