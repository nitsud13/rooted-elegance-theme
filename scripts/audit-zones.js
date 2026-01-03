#!/usr/bin/env node

/**
 * Zone Format Audit Script
 *
 * Identifies zone format inconsistencies across all products in Shopify.
 * Categorizes products by their zone metafield status:
 * - none: No zones assigned
 * - old: Uses "zone-X" format
 * - new: Uses plain "X" format
 * - mixed: Has both formats (unlikely but possible)
 *
 * Usage:
 *   node audit-zones.js              # Run audit
 *   node audit-zones.js --verbose    # Show detailed product list
 */

require('dotenv').config();

const CONFIG = {
  shopifyStore: process.env.SHOPIFY_STORE_DOMAIN,
  accessToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
  apiVersion: '2024-10',
  metafieldNamespace: 'custom',
  metafieldKey: 'usda_hardiness_zones',
  verbose: process.argv.includes('--verbose'),
};

// Validate configuration
function validateConfig() {
  const missing = [];
  if (!CONFIG.shopifyStore) missing.push('SHOPIFY_STORE_DOMAIN');
  if (!CONFIG.accessToken) missing.push('SHOPIFY_ADMIN_API_TOKEN');

  if (missing.length > 0) {
    console.error('✗ Missing required environment variables:');
    missing.forEach((v) => console.error(`  - ${v}`));
    console.error('\nCreate a .env file with these values.');
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
        (m) => m.node.key === CONFIG.metafieldKey
      );

      let existingZones = null;
      if (zoneMetafield) {
        try {
          existingZones = JSON.parse(zoneMetafield.node.value);
        } catch {
          existingZones = [zoneMetafield.node.value];
        }
      }

      products.push({
        id: product.id,
        title: product.title,
        handle: product.handle,
        existingZones: existingZones,
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

// Analyze zone format for a product
function analyzeZoneFormat(zones) {
  if (!zones || zones.length === 0) return 'none';

  const hasOldFormat = zones.some(
    (z) => typeof z === 'string' && z.toLowerCase().includes('zone')
  );
  const hasNewFormat = zones.some(
    (z) => typeof z === 'string' && !z.toLowerCase().includes('zone')
  );

  if (hasOldFormat && hasNewFormat) return 'mixed';
  if (hasOldFormat) return 'old';
  return 'new';
}

// Main execution
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║           Zone Format Audit Script                     ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  validateConfig();

  const products = await fetchAllProducts();

  const results = {
    noZones: [],
    oldFormat: [],
    newFormat: [],
    mixedFormat: [],
  };

  for (const product of products) {
    const format = analyzeZoneFormat(product.existingZones);

    switch (format) {
      case 'none':
        results.noZones.push(product);
        break;
      case 'old':
        results.oldFormat.push(product);
        break;
      case 'new':
        results.newFormat.push(product);
        break;
      case 'mixed':
        results.mixedFormat.push(product);
        break;
    }
  }

  // Print summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                     AUDIT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Total Products:     ${products.length}`);
  console.log(`───────────────────────────────────────────────────────────`);
  console.log(`✓ New Format:       ${results.newFormat.length} (plain numbers like "7")`);
  console.log(`⚠ Old Format:       ${results.oldFormat.length} (prefixed like "zone-7")`);
  console.log(`✗ No Zones:         ${results.noZones.length}`);
  console.log(`⚡ Mixed Format:     ${results.mixedFormat.length}`);
  console.log('');

  // Action items
  if (results.oldFormat.length > 0 || results.noZones.length > 0) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                   ACTION REQUIRED');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (results.oldFormat.length > 0) {
      console.log(`🔄 ${results.oldFormat.length} products need format normalization`);
      console.log('   Run: node scripts/populate-zones.js --normalize\n');
    }

    if (results.noZones.length > 0) {
      console.log(`📝 ${results.noZones.length} products have no zones assigned`);
      console.log('   Run: node scripts/populate-zones.js\n');
    }
  } else {
    console.log('✅ All products have zones in the correct format!\n');
  }

  // Verbose output
  if (CONFIG.verbose) {
    if (results.noZones.length > 0) {
      console.log('───────────────────────────────────────────────────────────');
      console.log('Products with NO ZONES:');
      console.log('───────────────────────────────────────────────────────────');
      results.noZones.forEach((p) => console.log(`  • ${p.title}`));
      console.log('');
    }

    if (results.oldFormat.length > 0) {
      console.log('───────────────────────────────────────────────────────────');
      console.log('Products with OLD FORMAT (need normalization):');
      console.log('───────────────────────────────────────────────────────────');
      results.oldFormat.forEach((p) => {
        console.log(`  • ${p.title}`);
        console.log(`    Current: ${JSON.stringify(p.existingZones)}`);
      });
      console.log('');
    }

    if (results.mixedFormat.length > 0) {
      console.log('───────────────────────────────────────────────────────────');
      console.log('Products with MIXED FORMAT:');
      console.log('───────────────────────────────────────────────────────────');
      results.mixedFormat.forEach((p) => {
        console.log(`  • ${p.title}`);
        console.log(`    Current: ${JSON.stringify(p.existingZones)}`);
      });
      console.log('');
    }
  } else if (results.oldFormat.length > 0 || results.noZones.length > 0) {
    console.log('💡 Run with --verbose to see detailed product lists\n');
  }

  // Return summary for programmatic use
  return {
    total: products.length,
    newFormat: results.newFormat.length,
    oldFormat: results.oldFormat.length,
    noZones: results.noZones.length,
    mixedFormat: results.mixedFormat.length,
    details: results,
  };
}

// Run the script
main().catch((error) => {
  console.error('\n✗ Fatal error:', error.message);
  process.exit(1);
});
