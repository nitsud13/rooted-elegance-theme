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
