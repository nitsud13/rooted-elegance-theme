/**
 * Shop by Growing Zone - Page Logic
 *
 * Handles zone selection, product filtering, and UI state for the
 * dedicated Shop by Zone landing page.
 */

const ShopByZone = {
  // State
  selectedZone: null,
  selectedTemp: null,

  // DOM Elements (cached on init)
  elements: {
    picker: null,
    activeZone: null,
    zoneNumber: null,
    zoneTemp: null,
    zipInput: null,
    zipError: null,
    prompt: null,
    empty: null,
    emptyZone: null,
    resultsHeader: null,
    resultsCount: null,
    resultsZone: null,
    grid: null,
    zoneButtons: null,
  },

  // Temperature ranges for each zone
  tempRanges: {
    3: '-40 to -30',
    4: '-30 to -20',
    5: '-20 to -10',
    6: '-10 to 0',
    7: '0 to 10',
    8: '10 to 20',
    9: '20 to 30',
    10: '30 to 40',
    11: '40 to 50',
  },

  /**
   * Initialize the Shop by Zone page
   */
  init() {
    // Cache DOM elements
    this.cacheElements();

    // Check for saved zone in localStorage
    const savedZone = this.getSavedZone();
    if (savedZone) {
      this.selectedZone = parseInt(savedZone.zone);
      this.selectedTemp = this.tempRanges[this.selectedZone] + '°F';
      this.showActiveZone();
      this.filterProducts();
    }

    // Set up ZIP input enter key
    if (this.elements.zipInput) {
      this.elements.zipInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.lookupZip();
        }
      });
    }

    // Listen for zone:changed events from other components
    document.addEventListener('zone:changed', (e) => {
      if (e.detail && e.detail.zone) {
        this.selectedZone = parseInt(e.detail.zone);
        this.selectedTemp = this.tempRanges[this.selectedZone] + '°F';
        this.showActiveZone();
        this.filterProducts();
      }
    });
  },

  /**
   * Cache DOM elements for performance
   */
  cacheElements() {
    this.elements = {
      picker: document.getElementById('sbz-picker'),
      activeZone: document.getElementById('sbz-active-zone'),
      zoneNumber: document.getElementById('sbz-zone-number'),
      zoneTemp: document.getElementById('sbz-zone-temp'),
      zipInput: document.getElementById('sbz-zip-input'),
      zipError: document.getElementById('sbz-zip-error'),
      prompt: document.getElementById('sbz-prompt'),
      empty: document.getElementById('sbz-empty'),
      emptyZone: document.getElementById('sbz-empty-zone'),
      resultsHeader: document.getElementById('sbz-results-header'),
      resultsCount: document.getElementById('sbz-results-count'),
      resultsZone: document.getElementById('sbz-results-zone'),
      grid: document.getElementById('sbz-grid'),
      zoneButtons: document.querySelectorAll('.sbz-picker__zone-btn'),
    };
  },

  /**
   * Get saved zone from localStorage
   */
  getSavedZone() {
    try {
      const saved = localStorage.getItem('rooted_elegance_zone');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Save zone to localStorage
   */
  saveZone(zone, temp, zipCode = null) {
    const data = {
      zone: zone,
      temp: temp,
      zipCode: zipCode,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem('rooted_elegance_zone', JSON.stringify(data));

      // Dispatch event for other components
      const event = new CustomEvent('zone:changed', {
        detail: data,
        bubbles: true,
      });
      document.dispatchEvent(event);
    } catch (e) {
      console.error('Failed to save zone:', e);
    }
  },

  /**
   * Select a zone from button click
   */
  selectZone(zone, temp) {
    this.selectedZone = zone;
    this.selectedTemp = temp;

    // Update button states
    this.elements.zoneButtons.forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.dataset.zone) === zone);
    });

    // Save and update UI
    this.saveZone(zone, temp);
    this.showActiveZone();
    this.filterProducts();

    // Scroll to results
    const resultsSection = document.getElementById('sbz-results');
    if (resultsSection) {
      setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  },

  /**
   * Look up zone from ZIP code
   */
  async lookupZip() {
    const zipInput = this.elements.zipInput;
    const zipError = this.elements.zipError;
    const zip = zipInput ? zipInput.value.trim() : '';

    // Validate ZIP
    if (!/^\d{5}$/.test(zip)) {
      if (zipError) {
        zipError.hidden = false;
        zipError.textContent = 'Please enter a valid 5-digit ZIP code';
      }
      if (zipInput) {
        zipInput.focus();
      }
      return;
    }

    // Hide error
    if (zipError) {
      zipError.hidden = true;
    }

    // Try to use ZoneSelector if available
    if (window.ZoneSelector && typeof window.ZoneSelector.getZoneFromZip === 'function') {
      try {
        const result = await window.ZoneSelector.getZoneFromZip(zip);
        if (result && result.zone) {
          this.selectedZone = parseInt(result.zone);
          this.selectedTemp = this.tempRanges[this.selectedZone] + '°F';
          this.saveZone(this.selectedZone, this.selectedTemp, zip);
          this.showActiveZone();
          this.filterProducts();

          // Scroll to results
          const resultsSection = document.getElementById('sbz-results');
          if (resultsSection) {
            setTimeout(() => {
              resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
          }
          return;
        }
      } catch (e) {
        console.error('Zone lookup failed:', e);
      }
    }

    // Fallback: Use approximate zone based on ZIP prefix
    const zone = this.approximateZoneFromZip(zip);
    if (zone) {
      this.selectedZone = zone;
      this.selectedTemp = this.tempRanges[zone] + '°F';
      this.saveZone(zone, this.selectedTemp, zip);
      this.showActiveZone();
      this.filterProducts();

      // Scroll to results
      const resultsSection = document.getElementById('sbz-results');
      if (resultsSection) {
        setTimeout(() => {
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } else {
      if (zipError) {
        zipError.hidden = false;
        zipError.textContent = 'Could not determine zone for this ZIP code';
      }
    }
  },

  /**
   * Approximate zone from ZIP code prefix (fallback method)
   */
  approximateZoneFromZip(zip) {
    const prefix = parseInt(zip.substring(0, 3));

    // Very rough approximation based on ZIP code regions
    // This is a simplified fallback - ZoneSelector API is preferred
    const zoneMap = [
      { min: 995, max: 999, zone: 4 },  // Alaska
      { min: 967, max: 968, zone: 11 }, // Hawaii
      { min: 900, max: 935, zone: 9 },  // Southern California
      { min: 850, max: 865, zone: 8 },  // Arizona
      { min: 750, max: 799, zone: 8 },  // Texas
      { min: 700, max: 714, zone: 9 },  // Louisiana
      { min: 320, max: 349, zone: 9 },  // Florida
      { min: 300, max: 319, zone: 8 },  // Georgia
      { min: 270, max: 289, zone: 7 },  // North Carolina
      { min: 220, max: 246, zone: 7 },  // Virginia
      { min: 200, max: 219, zone: 7 },  // DC area
      { min: 150, max: 196, zone: 6 },  // Pennsylvania
      { min: 100, max: 149, zone: 6 },  // New York
      { min: 10, max: 69, zone: 5 },    // New England
      { min: 570, max: 588, zone: 4 },  // North Dakota
      { min: 590, max: 599, zone: 4 },  // Montana
      { min: 800, max: 816, zone: 5 },  // Colorado
      { min: 970, max: 979, zone: 6 },  // Oregon
      { min: 980, max: 994, zone: 6 },  // Washington
    ];

    for (const range of zoneMap) {
      if (prefix >= range.min && prefix <= range.max) {
        return range.zone;
      }
    }

    // Default to zone 7 (moderate) if unknown
    return 7;
  },

  /**
   * Show the active zone display and hide the picker
   */
  showActiveZone() {
    const { picker, activeZone, zoneNumber, zoneTemp } = this.elements;

    if (zoneNumber) {
      zoneNumber.textContent = this.selectedZone;
    }
    if (zoneTemp) {
      zoneTemp.textContent = this.selectedTemp;
    }
    if (picker) {
      picker.hidden = true;
    }
    if (activeZone) {
      activeZone.hidden = false;
    }
  },

  /**
   * Clear the selected zone and show the picker
   */
  clearZone() {
    const { picker, activeZone, prompt, resultsHeader, grid } = this.elements;

    this.selectedZone = null;
    this.selectedTemp = null;

    // Clear localStorage
    try {
      localStorage.removeItem('rooted_elegance_zone');
    } catch (e) {
      // Ignore
    }

    // Reset button states
    this.elements.zoneButtons.forEach((btn) => {
      btn.classList.remove('active');
    });

    // Show picker, hide active zone
    if (picker) {
      picker.hidden = false;
    }
    if (activeZone) {
      activeZone.hidden = true;
    }

    // Reset results
    if (prompt) {
      prompt.hidden = false;
    }
    if (resultsHeader) {
      resultsHeader.hidden = true;
    }

    // Hide all products
    if (grid) {
      const products = grid.querySelectorAll('.product-card');
      products.forEach((card) => {
        card.classList.remove('zone-visible');
      });
    }

    // Dispatch event
    const event = new CustomEvent('zone:changed', {
      detail: { zone: null },
      bubbles: true,
    });
    document.dispatchEvent(event);
  },

  /**
   * Filter products by the selected zone
   */
  filterProducts() {
    const {
      grid,
      prompt,
      empty,
      emptyZone,
      resultsHeader,
      resultsCount,
      resultsZone,
    } = this.elements;

    if (!grid || !this.selectedZone) {
      return;
    }

    const products = grid.querySelectorAll('.product-card');
    let visibleCount = 0;

    products.forEach((card, index) => {
      const zoneData = card.dataset.productZone;

      if (!zoneData) {
        // No zone data - hide the product
        card.classList.remove('zone-visible');
        return;
      }

      // Parse zone data (can be comma-separated list or single value)
      const zones = zoneData.split(',').map((z) => parseInt(z.trim()));
      const isCompatible = zones.includes(this.selectedZone);

      if (isCompatible) {
        card.classList.add('zone-visible');
        // Stagger animation
        card.style.animationDelay = `${Math.min(visibleCount * 0.05, 0.5)}s`;
        visibleCount++;
      } else {
        card.classList.remove('zone-visible');
      }
    });

    // Update UI based on results
    if (prompt) {
      prompt.hidden = true;
    }

    if (visibleCount > 0) {
      // Show results
      if (empty) {
        empty.hidden = true;
      }
      if (resultsHeader) {
        resultsHeader.hidden = false;
      }
      if (resultsCount) {
        resultsCount.textContent = visibleCount;
      }
      if (resultsZone) {
        resultsZone.textContent = this.selectedZone;
      }
    } else {
      // Show empty state
      if (empty) {
        empty.hidden = false;
      }
      if (emptyZone) {
        emptyZone.textContent = this.selectedZone;
      }
      if (resultsHeader) {
        resultsHeader.hidden = true;
      }
    }
  },

  /**
   * Load more products (placeholder for future pagination)
   */
  loadMore() {
    // Future: Implement pagination or infinite scroll
    console.log('Load more clicked - implement pagination');
  },
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  ShopByZone.init();
});

// Expose globally for onclick handlers
window.ShopByZone = ShopByZone;
