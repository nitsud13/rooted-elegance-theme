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
      '740': '7a', '741': '7b', '742': '7b', '743': '7a', '744': '7b',
      '745': '7b', '746': '7a', '747': '8a', '748': '7b', '749': '7b',
      '750': '8b', '751': '8b', '752': '8b', '753': '8b', '754': '8b',
      '755': '8b', '756': '8b', '757': '8b', '758': '8b', '759': '9a',
      '760': '8b', '761': '8b', '762': '8a', '763': '8a', '764': '8a',
      '765': '8b', '766': '8b', '767': '8b', '768': '8b', '769': '8a',
      '770': '9b', '771': '9b', '772': '9b', '773': '9a', '774': '9b',
      '775': '9b', '776': '9a', '777': '9b', '778': '9a', '779': '9b',
      '780': '9a', '781': '9a', '782': '9a', '783': '9b', '784': '10a',
      '785': '10a', '786': '9a', '787': '9a', '788': '9a', '789': '9a',
      '790': '7a', '791': '7a', '792': '7b', '793': '7b', '794': '7b',
      '795': '8a', '796': '8a', '797': '8a', '798': '8b', '799': '8b',
      '800': '6a', '801': '6a', '802': '6a', '803': '6a', '804': '5b',
      '805': '5b', '806': '5b', '807': '5b', '808': '5b', '809': '6a',
      '810': '6a', '811': '5b', '812': '5b', '813': '6b', '814': '6b',
      '815': '7a', '816': '6a', '817': '5b', '818': '5b', '819': '5b',
      '820': '5b', '821': '4b', '822': '5a', '823': '5a', '824': '5a',
      '825': '5a', '826': '5a', '827': '4b', '828': '5a', '829': '5a',
      '830': '4b', '831': '5b', '832': '5b', '833': '6b', '834': '5a',
      '835': '6b', '836': '7a', '837': '7a', '838': '6b', '839': '6b',
      '840': '7a', '841': '7b', '842': '7a', '843': '6a', '844': '7a',
      '845': '6a', '846': '6a', '847': '6a', '848': '7b', '849': '8b',
      '850': '10a', '851': '9a', '852': '9b', '853': '9b', '854': '9a',
      '855': '8b', '856': '8b', '857': '9b', '858': '8a', '859': '6b',
      '860': '7a', '861': '7b', '862': '8a', '863': '8b', '864': '9b',
      '865': '7a', '866': '6b', '867': '6b', '868': '6b', '869': '6b',
      '870': '6b', '871': '7b', '872': '6b', '873': '6a', '874': '7a',
      '875': '6b', '876': '7b', '877': '6a', '878': '7b', '879': '8a',
      '880': '8b', '881': '7a', '882': '8a', '883': '7a', '884': '7a',
      '885': '8b', '886': '8b', '887': '8b', '888': '8a', '889': '9a',
      '890': '9b', '891': '9b', '892': '7b', '893': '6a', '894': '7a',
      '895': '7b', '896': '7b', '897': '7a', '898': '5b', '899': '8a',
      '900': '10b', '901': '10b', '902': '10b', '903': '10b', '904': '11a',
      '905': '10b', '906': '10b', '907': '10b', '908': '10b', '909': '10b',
      '910': '10a', '911': '10a', '912': '10a', '913': '10a', '914': '10a',
      '915': '10a', '916': '10a', '917': '10a', '918': '10a', '919': '10b',
      '920': '10a', '921': '10b', '922': '10a', '923': '8b', '924': '10a',
      '925': '9b', '926': '10b', '927': '10b', '928': '10b', '929': '10b',
      '930': '10a', '931': '10b', '932': '9b', '933': '9b', '934': '10a',
      '935': '8b', '936': '9b', '937': '9b', '938': '9b', '939': '9b',
      '940': '10a', '941': '10b', '942': '9b', '943': '9b', '944': '10a',
      '945': '9b', '946': '10a', '947': '10a', '948': '10a', '949': '9b',
      '950': '9b', '951': '9b', '952': '9b', '953': '9b', '954': '9b',
      '955': '9b', '956': '9b', '957': '9b', '958': '9b', '959': '9b',
      '960': '9a', '961': '6b', '962': '7b', '963': '8b', '964': '9b',
      '965': '10b', '966': '11b', '967': '12b', '968': '12b', '969': '10b',
      '970': '8b', '971': '8b', '972': '9a', '973': '8b', '974': '8b',
      '975': '8b', '976': '6b', '977': '6b', '978': '6b', '979': '6b',
      '980': '8b', '981': '9a', '982': '8b', '983': '8b', '984': '8b',
      '985': '8b', '986': '8b', '987': '7b', '988': '7a', '989': '7a',
      '990': '6b', '991': '6b', '992': '7a', '993': '7a', '994': '7a',
      '995': '5a', '996': '4b', '997': '2a', '998': '7a', '999': '7b'
    }
  };

  // Storage key
  const STORAGE_KEY = 'rooted_elegance_zone';
  let zipToZoneData = null;
  let zipDataPromise = null;

  /**
   * Lazy-load ZIP prefix mapping from compiled asset
   */
  function ensureZipDataLoaded() {
    if (zipToZoneData) return Promise.resolve(zipToZoneData);
    if (zipDataPromise) return zipDataPromise;

    zipDataPromise = new Promise((resolve, reject) => {
      const src = (window.ZIP_TO_ZONE_URL) ? window.ZIP_TO_ZONE_URL : '/assets/zip_to_zone_output.js';
      const script = document.createElement('script');
      script.src = src;
      script.async = true;

      script.onload = () => {
        zipToZoneData = window.zipToZoneData || window.zipToZone || null;
        if (zipToZoneData) {
          resolve(zipToZoneData);
        } else {
          reject(new Error('Zone data unavailable'));
        }
      };

      script.onerror = () => reject(new Error('Zone data failed to load'));
      document.head.appendChild(script);
    });

    return zipDataPromise;
  }

  /**
   * Get zone from ZIP code
   */
  async function getZoneFromZip(zipCode) {
    const data = zipToZoneData || await ensureZipDataLoaded().catch(() => null);
    if (!data) return null;

    const prefix = zipCode.substring(0, 3);
    const zoneCode = data[prefix];

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
      // Also set simple customer_zone key for theme.liquid header badge
      localStorage.setItem('customer_zone', zoneData.zone);
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
      // Also clear simple customer_zone key
      localStorage.removeItem('customer_zone');
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
      async function handleZipSubmit() {
        const zipCode = input?.value.trim();

        if (!zipCode || zipCode.length !== 5) {
          showError('Please enter a valid 5-digit ZIP code.');
          return;
        }

        const zoneData = await getZoneFromZip(zipCode);

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

        showError('Location lookup is unavailable right now. Please enter your ZIP code.');
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

    // Update header zone badge
    document.querySelectorAll('[data-zone-badge] [data-zone-value]').forEach(el => {
      el.textContent = userZone;
    });

    // Also update any other header zone displays
    document.querySelectorAll('.site-header [data-zone-value]').forEach(el => {
      el.textContent = userZone;
    });

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
   * Update header zone badge on page load if zone is saved
   */
  function initHeaderZoneBadge() {
    const savedZone = getSavedZone();
    if (savedZone) {
      // Update existing header badge
      document.querySelectorAll('[data-zone-badge] [data-zone-value]').forEach(el => {
        el.textContent = savedZone.zone;
      });
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
