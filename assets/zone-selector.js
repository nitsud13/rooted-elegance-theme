/**
 * Growing Zone Selector
 * Handles ZIP code to USDA hardiness zone lookup with geolocation support.
 *
 * Features:
 * - ZIP code input validation and lookup
 * - Geolocation support with reverse geocoding
 * - localStorage persistence
 * - Updates product filtering across the site
 */

(function() {
  'use strict';

  // USDA Hardiness Zone data - ZIP prefix to zone mapping
  // This is a simplified dataset. For production, use a complete ZIP-to-zone database.
  const ZONE_DATA = {
    // Zone temperature ranges (°F)
    zones: {
      '1a': { min: -60, max: -55, label: '1a' },
      '1b': { min: -55, max: -50, label: '1b' },
      '2a': { min: -50, max: -45, label: '2a' },
      '2b': { min: -45, max: -40, label: '2b' },
      '3a': { min: -40, max: -35, label: '3a' },
      '3b': { min: -35, max: -30, label: '3b' },
      '4a': { min: -30, max: -25, label: '4a' },
      '4b': { min: -25, max: -20, label: '4b' },
      '5a': { min: -20, max: -15, label: '5a' },
      '5b': { min: -15, max: -10, label: '5b' },
      '6a': { min: -10, max: -5, label: '6a' },
      '6b': { min: -5, max: 0, label: '6b' },
      '7a': { min: 0, max: 5, label: '7a' },
      '7b': { min: 5, max: 10, label: '7b' },
      '8a': { min: 10, max: 15, label: '8a' },
      '8b': { min: 15, max: 20, label: '8b' },
      '9a': { min: 20, max: 25, label: '9a' },
      '9b': { min: 25, max: 30, label: '9b' },
      '10a': { min: 30, max: 35, label: '10a' },
      '10b': { min: 35, max: 40, label: '10b' },
      '11a': { min: 40, max: 45, label: '11a' },
      '11b': { min: 45, max: 50, label: '11b' },
      '12a': { min: 50, max: 55, label: '12a' },
      '12b': { min: 55, max: 60, label: '12b' },
      '13a': { min: 60, max: 65, label: '13a' },
      '13b': { min: 65, max: 70, label: '13b' }
    },

    // Simplified ZIP prefix to zone mapping (first 3 digits)
    // In production, use a complete database or API
    zipToZone: {
      // Northeast
      '010': '5b', '011': '5b', '012': '5a', '013': '5b', '014': '6a',
      '015': '6a', '016': '6a', '017': '6b', '018': '6b', '019': '6a',
      '020': '6b', '021': '6b', '022': '6b', '023': '6a', '024': '6a',
      '025': '6a', '026': '5b', '027': '5b',

      // New York
      '100': '7a', '101': '7a', '102': '6b', '103': '6b', '104': '6b',
      '105': '6b', '106': '6b', '107': '6a', '108': '6a', '109': '5b',
      '110': '7a', '111': '7a', '112': '7a', '113': '7a', '114': '7b',
      '115': '7b', '116': '7a', '117': '7a', '118': '7a', '119': '7a',
      '120': '5b', '121': '5b', '122': '5a', '123': '5a', '124': '5b',
      '125': '5b', '126': '5b', '127': '6a', '128': '4b', '129': '5a',
      '130': '5a', '131': '5a', '132': '5a', '133': '5b', '134': '5b',
      '135': '5b', '136': '5b', '137': '6a', '138': '5b', '139': '5b',
      '140': '6a', '141': '6a', '142': '6a', '143': '5b', '144': '5b',
      '145': '5b', '146': '5b', '147': '5b', '148': '5b', '149': '5b',

      // Mid-Atlantic
      '150': '6b', '151': '6b', '152': '6a', '153': '6a', '154': '6a',
      '155': '6a', '156': '6a', '157': '6b', '158': '6a', '159': '6a',
      '160': '6a', '161': '6a', '162': '5b', '163': '5b', '164': '5b',
      '165': '6a', '166': '6a', '167': '6a', '168': '6a', '169': '6a',
      '170': '6b', '171': '6b', '172': '6b', '173': '6b', '174': '6b',
      '175': '6b', '176': '6b', '177': '6b', '178': '6b', '179': '6b',
      '180': '6b', '181': '6a', '182': '5b', '183': '6a', '184': '6a',
      '185': '6a', '186': '5b', '187': '6a', '188': '6b', '189': '6b',
      '190': '7a', '191': '7a', '192': '7a', '193': '6b', '194': '7a',
      '195': '7a', '196': '7a', '197': '7a', '198': '7a', '199': '7a',

      // DC, Maryland, Virginia
      '200': '7a', '201': '7a', '202': '7a', '203': '7a', '204': '7a',
      '205': '7a', '206': '7a', '207': '7a', '208': '7a', '209': '7a',
      '210': '7a', '211': '7a', '212': '7a', '213': '7a', '214': '7b',
      '215': '7a', '216': '7a', '217': '6b', '218': '6b', '219': '6b',
      '220': '7a', '221': '7a', '222': '7a', '223': '7a', '224': '7a',
      '225': '7a', '226': '7a', '227': '7a', '228': '7a', '229': '7b',
      '230': '7a', '231': '7b', '232': '7b', '233': '8a', '234': '7b',
      '235': '8a', '236': '8a', '237': '7b', '238': '7a', '239': '7a',
      '240': '6b', '241': '6b', '242': '6b', '243': '6b', '244': '6b',
      '245': '6b', '246': '6b', '247': '6b', '248': '6a', '249': '6b',

      // North Carolina
      '270': '7b', '271': '7b', '272': '7b', '273': '7b', '274': '7b',
      '275': '7b', '276': '7a', '277': '7b', '278': '7a', '279': '7a',
      '280': '8a', '281': '8a', '282': '7b', '283': '8a', '284': '8a',
      '285': '8a', '286': '7b', '287': '7b', '288': '7a', '289': '7b',

      // South Carolina
      '290': '8a', '291': '8a', '292': '8a', '293': '8a', '294': '8a',
      '295': '8b', '296': '8a', '297': '7b', '298': '8a', '299': '8b',

      // Georgia
      '300': '7b', '301': '8a', '302': '8a', '303': '7b', '304': '8a',
      '305': '8a', '306': '8a', '307': '8a', '308': '8a', '309': '8a',
      '310': '8a', '311': '8a', '312': '8b', '313': '8b', '314': '8b',
      '315': '8b', '316': '8b', '317': '8b', '318': '9a', '319': '9a',

      // Florida
      '320': '8b', '321': '9a', '322': '9a', '323': '9b', '324': '9a',
      '325': '9a', '326': '9a', '327': '9b', '328': '9b', '329': '10a',
      '330': '10a', '331': '10a', '332': '10b', '333': '10b', '334': '10b',
      '335': '10a', '336': '10a', '337': '10a', '338': '10a', '339': '10a',
      '340': '10b', '341': '10a', '342': '9b', '344': '9b', '346': '9b',
      '347': '9b', '349': '9a',

      // Ohio
      '430': '6a', '431': '5b', '432': '6a', '433': '6a', '434': '5b',
      '435': '5b', '436': '5b', '437': '5b', '438': '5b', '439': '5b',
      '440': '6a', '441': '6a', '442': '6a', '443': '5b', '444': '5b',
      '445': '6a', '446': '5b', '447': '6a', '448': '6a', '449': '6a',
      '450': '6a', '451': '6a', '452': '6a', '453': '6a', '454': '5b',
      '455': '6a', '456': '6a', '457': '6a', '458': '6a', '459': '6a',

      // Michigan
      '480': '6a', '481': '6a', '482': '6a', '483': '6a', '484': '5b',
      '485': '5b', '486': '5b', '487': '5b', '488': '5b', '489': '5b',
      '490': '5b', '491': '5b', '492': '5b', '493': '5a', '494': '5a',
      '495': '5a', '496': '5a', '497': '4b', '498': '4b', '499': '4b',

      // Illinois
      '600': '5b', '601': '5b', '602': '5b', '603': '5b', '604': '5b',
      '605': '5b', '606': '5b', '607': '5b', '608': '5a', '609': '5b',
      '610': '5b', '611': '5a', '612': '5a', '613': '5a', '614': '5b',
      '615': '5b', '616': '5b', '617': '5b', '618': '6a', '619': '5b',
      '620': '5b', '621': '5b', '622': '6a', '623': '6a', '624': '6a',
      '625': '5b', '626': '5b', '627': '6a', '628': '6a', '629': '6b',

      // Texas
      '750': '8a', '751': '8a', '752': '8a', '753': '8a', '754': '8a',
      '755': '8a', '756': '8a', '757': '8a', '758': '8b', '759': '8a',
      '760': '7b', '761': '8a', '762': '8a', '763': '8a', '764': '8a',
      '765': '8a', '766': '7b', '767': '7b', '768': '7b', '769': '7b',
      '770': '9a', '771': '9a', '772': '9a', '773': '9a', '774': '9a',
      '775': '9a', '776': '9a', '777': '9a', '778': '9b', '779': '9a',
      '780': '9a', '781': '9a', '782': '9a', '783': '9b', '784': '9b',
      '785': '9b', '786': '9b', '787': '8b', '788': '8b', '789': '8a',
      '790': '7a', '791': '7a', '792': '7a', '793': '7a', '794': '7a',
      '795': '7a', '796': '7b', '797': '7b', '798': '8a', '799': '7b',

      // California
      '900': '10b', '901': '10b', '902': '10b', '903': '10a', '904': '10a',
      '905': '10b', '906': '10b', '907': '10a', '908': '10a', '909': '9b',
      '910': '10a', '911': '10a', '912': '10a', '913': '10a', '914': '9b',
      '915': '9b', '916': '9b', '917': '9b', '918': '10a', '919': '9b',
      '920': '10b', '921': '10b', '922': '9b', '923': '9b', '924': '9b',
      '925': '9b', '926': '10a', '927': '10a', '928': '10a', '929': '9a',
      '930': '9b', '931': '9a', '932': '9a', '933': '9a', '934': '9b',
      '935': '8b', '936': '9a', '937': '9a', '938': '9a', '939': '9b',
      '940': '10a', '941': '10a', '942': '10a', '943': '9b', '944': '10a',
      '945': '10a', '946': '10a', '947': '10a', '948': '9b', '949': '9b',
      '950': '9b', '951': '9b', '952': '9a', '953': '9b', '954': '9a',
      '955': '9a', '956': '9a', '957': '9a', '958': '9a', '959': '9a',
      '960': '9a', '961': '8b',

      // Washington
      '980': '8b', '981': '8b', '982': '8b', '983': '8a', '984': '8a',
      '985': '8b', '986': '6b', '987': '6b', '988': '6a', '989': '6a',
      '990': '6b', '991': '6a', '992': '6a', '993': '5b', '994': '5b',

      // Oregon
      '970': '8b', '971': '8b', '972': '8b', '973': '8b', '974': '8a',
      '975': '8a', '976': '7b', '977': '6b', '978': '6b', '979': '6a',

      // Colorado
      '800': '5b', '801': '5b', '802': '5a', '803': '5a', '804': '5a',
      '805': '5a', '806': '5a', '807': '4b', '808': '4b', '809': '4b',
      '810': '5b', '811': '5a', '812': '4b', '813': '4b', '814': '4b',
      '815': '4b', '816': '5a',

      // Arizona
      '850': '9b', '851': '9b', '852': '9b', '853': '9a', '855': '8a',
      '856': '9a', '857': '8a', '859': '7a', '860': '9a', '863': '9b',
      '864': '8b', '865': '8b'
    }
  };

  // Storage key
  const STORAGE_KEY = 'rooted_elegance_zone';

  /**
   * Get zone from ZIP code
   */
  function getZoneFromZip(zipCode) {
    const prefix = zipCode.substring(0, 3);
    const zoneCode = ZONE_DATA.zipToZone[prefix];

    if (zoneCode) {
      return {
        zone: zoneCode,
        ...ZONE_DATA.zones[zoneCode]
      };
    }

    return null;
  }

  /**
   * Format temperature range
   */
  function formatTempRange(min, max) {
    return `${min}°F to ${max}°F`;
  }

  /**
   * Save zone to localStorage
   */
  function saveZone(zipCode, zoneData) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        zipCode,
        ...zoneData,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Could not save zone to localStorage:', e);
    }
  }

  /**
   * Get saved zone from localStorage
   */
  function getSavedZone() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read zone from localStorage:', e);
    }
    return null;
  }

  /**
   * Clear saved zone
   */
  function clearSavedZone() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Could not clear zone from localStorage:', e);
    }
  }

  /**
   * Dispatch custom event for zone change
   */
  function dispatchZoneChange(zoneData) {
    const event = new CustomEvent('zone:changed', {
      detail: zoneData,
      bubbles: true
    });
    document.dispatchEvent(event);
  }

  /**
   * Initialize zone selector
   */
  function initZoneSelector() {
    const forms = document.querySelectorAll('[data-zone-form]');

    forms.forEach(form => {
      const input = form.querySelector('[data-zone-input]');
      const submitBtn = form.querySelector('[data-zone-submit]');
      const geoBtn = form.querySelector('[data-zone-geo]');
      const errorEl = form.closest('.zone-selector').querySelector('[data-zone-error]');
      const errorMsg = errorEl?.querySelector('[data-zone-error-message]');
      const resultEl = form.closest('.zone-selector').querySelector('[data-zone-result]');
      const zoneValue = resultEl?.querySelector('[data-zone-value]');
      const tempRange = resultEl?.querySelector('[data-zone-temp-range]');
      const changeBtn = resultEl?.querySelector('[data-zone-change]');

      // Check for saved zone
      const savedZone = getSavedZone();
      if (savedZone && resultEl) {
        showResult(savedZone);
      }

      // Handle ZIP input
      if (input) {
        input.addEventListener('input', (e) => {
          // Only allow numbers
          e.target.value = e.target.value.replace(/\D/g, '').substring(0, 5);

          // Hide error on input
          if (errorEl) errorEl.hidden = true;
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleZipSubmit();
          }
        });
      }

      // Handle submit button
      if (submitBtn) {
        submitBtn.addEventListener('click', handleZipSubmit);
      }

      // Handle geolocation
      if (geoBtn) {
        geoBtn.addEventListener('click', handleGeolocation);
      }

      // Handle change button
      if (changeBtn) {
        changeBtn.addEventListener('click', () => {
          clearSavedZone();
          if (resultEl) resultEl.hidden = true;
          if (form) {
            form.hidden = false;
            input?.focus();
          }
        });
      }

      /**
       * Handle ZIP code submission
       */
      function handleZipSubmit() {
        const zipCode = input?.value.trim();

        if (!zipCode || zipCode.length !== 5) {
          showError('Please enter a valid 5-digit ZIP code.');
          return;
        }

        const zoneData = getZoneFromZip(zipCode);

        if (zoneData) {
          saveZone(zipCode, zoneData);
          showResult({ zipCode, ...zoneData });
          dispatchZoneChange({ zipCode, ...zoneData });
        } else {
          showError('We couldn\'t find zone data for that ZIP code. Please try another.');
        }
      }

      /**
       * Handle geolocation
       */
      function handleGeolocation() {
        if (!navigator.geolocation) {
          showError('Geolocation is not supported by your browser.');
          return;
        }

        geoBtn.disabled = true;
        geoBtn.innerHTML = `
          <svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          <span>Locating...</span>
        `;

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              // Use a reverse geocoding service to get ZIP from coordinates
              // For production, use Google Maps, Mapbox, or similar
              const { latitude, longitude } = position.coords;

              // Fallback: Use a simple lat/long to zone estimation
              // This is a rough estimation - for production use proper geocoding
              const zone = estimateZoneFromCoords(latitude, longitude);

              if (zone) {
                saveZone('GEOLOCATION', zone);
                showResult({ zipCode: 'Your Location', ...zone });
                dispatchZoneChange({ zipCode: 'GEOLOCATION', ...zone });
              } else {
                showError('Could not determine your zone. Please enter your ZIP code.');
              }
            } catch (e) {
              showError('Could not determine your location. Please enter your ZIP code.');
            } finally {
              resetGeoBtn();
            }
          },
          (error) => {
            let message = 'Could not access your location.';
            if (error.code === error.PERMISSION_DENIED) {
              message = 'Location access was denied. Please enter your ZIP code.';
            }
            showError(message);
            resetGeoBtn();
          }
        );
      }

      /**
       * Estimate zone from coordinates (rough estimation)
       */
      function estimateZoneFromCoords(lat, lng) {
        // Very rough estimation based on latitude
        // For production, use proper geocoding + database lookup
        let zoneCode;

        if (lat >= 45) zoneCode = '4b';
        else if (lat >= 42) zoneCode = '5b';
        else if (lat >= 39) zoneCode = '6b';
        else if (lat >= 36) zoneCode = '7a';
        else if (lat >= 33) zoneCode = '7b';
        else if (lat >= 30) zoneCode = '8a';
        else if (lat >= 27) zoneCode = '9a';
        else if (lat >= 25) zoneCode = '10a';
        else zoneCode = '10b';

        return {
          zone: zoneCode,
          ...ZONE_DATA.zones[zoneCode]
        };
      }

      /**
       * Reset geolocation button
       */
      function resetGeoBtn() {
        if (geoBtn) {
          geoBtn.disabled = false;
          geoBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="2" x2="12" y2="6"/>
              <line x1="12" y1="18" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="6" y2="12"/>
              <line x1="18" y1="12" x2="22" y2="12"/>
            </svg>
            <span>Use My Location</span>
          `;
        }
      }

      /**
       * Show error message
       */
      function showError(message) {
        if (errorEl && errorMsg) {
          errorMsg.textContent = message;
          errorEl.hidden = false;
        }
      }

      /**
       * Show result
       */
      function showResult(data) {
        if (resultEl && zoneValue && tempRange) {
          zoneValue.textContent = data.zone;
          tempRange.textContent = formatTempRange(data.min, data.max);
          resultEl.hidden = false;
          form.hidden = true;

          // Update any zone badges on the page
          updateZoneBadges(data.zone);
        }
      }
    });
  }

  /**
   * Update zone badges across the site
   */
  function updateZoneBadges(userZone) {
    const zoneNumber = parseInt(userZone);

    // Find all product cards and update compatibility indicators
    document.querySelectorAll('[data-product-zone]').forEach(el => {
      const productZones = el.dataset.productZone.split(',').map(z => parseInt(z.trim()));

      if (productZones.includes(zoneNumber)) {
        el.classList.add('zone-compatible');
        el.classList.remove('zone-incompatible');
      } else {
        el.classList.remove('zone-compatible');
        el.classList.add('zone-incompatible');
      }
    });
  }

  /**
   * Add persistent zone indicator to header
   */
  function initHeaderZoneBadge() {
    const savedZone = getSavedZone();
    if (savedZone) {
      // Create or update header badge
      let badge = document.querySelector('.header-zone-badge');

      if (!badge) {
        badge = document.createElement('a');
        badge.className = 'header-zone-badge';
        badge.href = '#zone-selector';
        badge.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="10" r="3"/>
            <path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/>
          </svg>
          <span class="header-zone-badge__label">Zone</span>
          <span class="header-zone-badge__value">${savedZone.zone}</span>
        `;

        // Insert into header (adjust selector as needed)
        const headerActions = document.querySelector('.header__icons, .header-icons, [data-header-icons]');
        if (headerActions) {
          headerActions.prepend(badge);
        }
      } else {
        badge.querySelector('.header-zone-badge__value').textContent = savedZone.zone;
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initZoneSelector();
      initHeaderZoneBadge();
    });
  } else {
    initZoneSelector();
    initHeaderZoneBadge();
  }

  // Export for external use
  window.ZoneSelector = {
    getZoneFromZip,
    getSavedZone,
    clearSavedZone
  };
})();
