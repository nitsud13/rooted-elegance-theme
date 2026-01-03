#!/usr/bin/env node
/**
 * USDA Zone Lookup Test Script
 * Tests ZIP code to zone mappings against the lookup table and source CSV data
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Test cases organized by region
const testCases = [
  // Northeast
  { zip: '01001', city: 'Springfield, MA', expectedZone: '6a', region: 'Northeast' },
  { zip: '10001', city: 'New York, NY', expectedZone: '7b', region: 'Northeast' },
  { zip: '02101', city: 'Boston, MA', expectedZone: '7a', region: 'Northeast' },
  { zip: '05401', city: 'Burlington, VT', expectedZone: '5a', region: 'Northeast' },
  { zip: '04401', city: 'Bangor, ME', expectedZone: '5a', region: 'Northeast' },

  // Southeast
  { zip: '32801', city: 'Orlando, FL', expectedZone: '10a', region: 'Southeast' },
  { zip: '33101', city: 'Miami, FL', expectedZone: '11a', region: 'Southeast' },
  { zip: '30301', city: 'Atlanta, GA', expectedZone: '8a', region: 'Southeast' },
  { zip: '27601', city: 'Raleigh, NC', expectedZone: '8a', region: 'Southeast' },
  { zip: '29401', city: 'Charleston, SC', expectedZone: '9a', region: 'Southeast' },

  // Midwest
  { zip: '60601', city: 'Chicago, IL', expectedZone: '6a', region: 'Midwest' },
  { zip: '55401', city: 'Minneapolis, MN', expectedZone: '5a', region: 'Midwest' },
  { zip: '48201', city: 'Detroit, MI', expectedZone: '6b', region: 'Midwest' },
  { zip: '43201', city: 'Columbus, OH', expectedZone: '6b', region: 'Midwest' },
  { zip: '46201', city: 'Indianapolis, IN', expectedZone: '6b', region: 'Midwest' },

  // Southwest
  { zip: '85001', city: 'Phoenix, AZ', expectedZone: '10a', region: 'Southwest' },
  { zip: '87501', city: 'Santa Fe, NM', expectedZone: '6b', region: 'Southwest' },
  { zip: '89101', city: 'Las Vegas, NV', expectedZone: '9b', region: 'Southwest' },
  { zip: '79901', city: 'El Paso, TX', expectedZone: '8b', region: 'Southwest' },

  // Texas
  { zip: '75201', city: 'Dallas, TX', expectedZone: '8b', region: 'Texas' },
  { zip: '77001', city: 'Houston, TX', expectedZone: '9b', region: 'Texas' },
  { zip: '78201', city: 'San Antonio, TX', expectedZone: '9a', region: 'Texas' },
  { zip: '73301', city: 'Austin, TX', expectedZone: '9a', region: 'Texas' },

  // Mountain West
  { zip: '80201', city: 'Denver, CO', expectedZone: '6a', region: 'Mountain West' },
  { zip: '84101', city: 'Salt Lake City, UT', expectedZone: '7b', region: 'Mountain West' },
  { zip: '59601', city: 'Helena, MT', expectedZone: '4b', region: 'Mountain West' },
  { zip: '82001', city: 'Cheyenne, WY', expectedZone: '5b', region: 'Mountain West' },

  // Pacific Northwest
  { zip: '98101', city: 'Seattle, WA', expectedZone: '9a', region: 'Pacific Northwest' },
  { zip: '97201', city: 'Portland, OR', expectedZone: '9a', region: 'Pacific Northwest' },
  { zip: '99201', city: 'Spokane, WA', expectedZone: '7a', region: 'Pacific Northwest' },

  // California
  { zip: '90001', city: 'Los Angeles, CA', expectedZone: '10b', region: 'California' },
  { zip: '94102', city: 'San Francisco, CA', expectedZone: '10b', region: 'California' },
  { zip: '92101', city: 'San Diego, CA', expectedZone: '10b', region: 'California' },
  { zip: '95814', city: 'Sacramento, CA', expectedZone: '9b', region: 'California' },

  // Alaska
  { zip: '99501', city: 'Anchorage, AK', expectedZone: '5a', region: 'Alaska' },
  { zip: '99701', city: 'Fairbanks, AK', expectedZone: '2a', region: 'Alaska' },
  { zip: '99801', city: 'Juneau, AK', expectedZone: '7a', region: 'Alaska' },

  // Hawaii
  { zip: '96701', city: 'Honolulu area, HI', expectedZone: '12b', region: 'Hawaii' },
  { zip: '96720', city: 'Hilo, HI', expectedZone: '12b', region: 'Hawaii' },
  { zip: '96740', city: 'Kailua-Kona, HI', expectedZone: '12b', region: 'Hawaii' }
];

// Load the lookup table from zip_to_zone_output.js
function loadLookupTable() {
  const lookupPath = path.join(__dirname, '..', 'zip_to_zone_output.js');
  const content = fs.readFileSync(lookupPath, 'utf8');

  // Extract the object from the file
  const match = content.match(/window\.zipToZoneData\s*=\s*(\{[\s\S]*?\});/);
  if (!match) {
    throw new Error('Could not parse lookup table');
  }

  // Parse the object (it's valid JS object literal)
  return eval('(' + match[1] + ')');
}

// Load source CSV data
function loadSourceCSV(filename) {
  const csvPath = path.join(__dirname, '..', filename);
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.trim().split('\n');

  const data = {};
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const [zipcode, zone] = lines[i].split(',');
    if (zipcode && zone) {
      data[zipcode.trim()] = zone.trim();
    }
  }
  return data;
}

// Get zone from lookup table using 3-digit prefix
function getZoneFromLookup(lookupTable, zipCode) {
  const prefix = zipCode.substring(0, 3);
  return lookupTable[prefix] || null;
}

// Get zone from source CSV (exact match)
function getZoneFromSource(sourceData, zipCode) {
  return sourceData[zipCode] || null;
}

// Main test function
function runTests() {
  console.log(`${colors.bold}${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}   USDA Zone Lookup Test Suite${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}========================================${colors.reset}\n`);

  // Load data
  let lookupTable, usSourceData, akSourceData, hiSourceData;

  try {
    console.log('Loading lookup table...');
    lookupTable = loadLookupTable();
    console.log(`  ${colors.green}✓${colors.reset} Loaded ${Object.keys(lookupTable).length} prefix mappings\n`);
  } catch (error) {
    console.error(`${colors.red}Error loading lookup table: ${error.message}${colors.reset}`);
    process.exit(1);
  }

  try {
    console.log('Loading source CSV data...');
    usSourceData = loadSourceCSV('phzm_us_zipcode_2023.csv');
    console.log(`  ${colors.green}✓${colors.reset} Loaded ${Object.keys(usSourceData).length} US ZIP codes`);

    akSourceData = loadSourceCSV('phzm_ak_zipcode_2023.csv');
    console.log(`  ${colors.green}✓${colors.reset} Loaded ${Object.keys(akSourceData).length} Alaska ZIP codes`);

    hiSourceData = loadSourceCSV('phzm_hi_zipcode_2023.csv');
    console.log(`  ${colors.green}✓${colors.reset} Loaded ${Object.keys(hiSourceData).length} Hawaii ZIP codes\n`);
  } catch (error) {
    console.error(`${colors.red}Error loading source CSV: ${error.message}${colors.reset}`);
    process.exit(1);
  }

  // Merge source data
  const allSourceData = { ...usSourceData, ...akSourceData, ...hiSourceData };

  // Run tests
  let passed = 0;
  let failed = 0;
  let currentRegion = '';
  const failures = [];

  console.log(`${colors.bold}Running tests...${colors.reset}\n`);

  for (const test of testCases) {
    // Print region header
    if (test.region !== currentRegion) {
      currentRegion = test.region;
      console.log(`${colors.bold}${colors.blue}${currentRegion}:${colors.reset}`);
    }

    const lookupZone = getZoneFromLookup(lookupTable, test.zip);
    const sourceZone = getZoneFromSource(allSourceData, test.zip);

    // Check if lookup matches expected
    const lookupPass = lookupZone === test.expectedZone;

    if (lookupPass) {
      passed++;
      console.log(`  ${colors.green}✓${colors.reset} ${test.zip} (${test.city}): ${lookupZone}`);
    } else {
      failed++;
      failures.push({
        ...test,
        lookupZone,
        sourceZone
      });
      console.log(`  ${colors.red}✗${colors.reset} ${test.zip} (${test.city}): Expected ${test.expectedZone}, Got ${lookupZone || 'null'}`);
      if (sourceZone && sourceZone !== lookupZone) {
        console.log(`    ${colors.yellow}  Source CSV shows: ${sourceZone}${colors.reset}`);
      }
    }
  }

  // Print summary
  console.log(`\n${colors.bold}${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}   Test Summary${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}========================================${colors.reset}\n`);

  const total = passed + failed;
  const percentage = ((passed / total) * 100).toFixed(1);

  console.log(`Total tests: ${total}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Pass rate: ${percentage}%\n`);

  if (failures.length > 0) {
    console.log(`${colors.bold}${colors.red}Failed Tests Details:${colors.reset}`);
    for (const f of failures) {
      console.log(`  - ${f.zip} (${f.city})`);
      console.log(`    Expected: ${f.expectedZone}`);
      console.log(`    Lookup returned: ${f.lookupZone || 'null'}`);
      console.log(`    Source CSV shows: ${f.sourceZone || 'not found'}`);
    }
  }

  // Cross-reference check: Compare lookup vs source for all test cases
  console.log(`\n${colors.bold}${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}   Lookup vs Source CSV Comparison${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}========================================${colors.reset}\n`);

  let matches = 0;
  let mismatches = 0;
  const mismatchDetails = [];

  for (const test of testCases) {
    const lookupZone = getZoneFromLookup(lookupTable, test.zip);
    const sourceZone = getZoneFromSource(allSourceData, test.zip);

    if (lookupZone === sourceZone) {
      matches++;
    } else {
      mismatches++;
      mismatchDetails.push({
        zip: test.zip,
        city: test.city,
        lookupZone,
        sourceZone
      });
    }
  }

  console.log(`Exact matches (lookup = source): ${matches}`);
  console.log(`Mismatches: ${mismatches}`);

  if (mismatchDetails.length > 0) {
    console.log(`\n${colors.yellow}Note: Mismatches are expected because lookup uses 3-digit prefix averaging.${colors.reset}`);
    console.log(`${colors.yellow}The lookup table provides a representative zone for the entire prefix area.${colors.reset}\n`);

    console.log('Mismatch details:');
    for (const m of mismatchDetails) {
      console.log(`  ${m.zip} (${m.city}): Lookup=${m.lookupZone}, Source=${m.sourceZone || 'N/A'}`);
    }
  }

  console.log(`\n${colors.bold}Test completed.${colors.reset}\n`);

  return failed === 0 ? 0 : 1;
}

// Run tests
const exitCode = runTests();
process.exit(exitCode);
