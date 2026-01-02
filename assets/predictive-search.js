/**
 * Predictive Search Drawer
 * Slide-down search with live results from Shopify Predictive Search API
 */
(function() {
  'use strict';

  const SELECTORS = {
    toggle: '[data-search-toggle]',
    drawer: '.search-drawer',
    overlay: '.search-drawer__overlay',
    panel: '.search-drawer__panel',
    close: '.search-drawer__close',
    form: '.search-drawer__form',
    input: '.search-drawer__input',
    results: '.search-drawer__results',
    productsGrid: '.search-drawer__products',
    collectionsGrid: '.search-drawer__collections',
    loading: '.search-drawer__loading',
    noResults: '.search-drawer__no-results',
    viewAll: '.search-drawer__view-all',
    viewAllLink: '.search-drawer__view-all-link',
    liveRegion: '.search-drawer__live-region'
  };

  const DEBOUNCE_DELAY = 300;
  const MIN_QUERY_LENGTH = 2;

  class PredictiveSearch {
    constructor() {
      this.drawer = document.querySelector(SELECTORS.drawer);
      if (!this.drawer) return;

      this.toggle = document.querySelector(SELECTORS.toggle);
      this.overlay = this.drawer.querySelector(SELECTORS.overlay);
      this.panel = this.drawer.querySelector(SELECTORS.panel);
      this.closeBtn = this.drawer.querySelector(SELECTORS.close);
      this.form = this.drawer.querySelector(SELECTORS.form);
      this.input = this.drawer.querySelector(SELECTORS.input);
      this.results = this.drawer.querySelector(SELECTORS.results);
      this.productsGrid = this.drawer.querySelector(SELECTORS.productsGrid);
      this.collectionsGrid = this.drawer.querySelector(SELECTORS.collectionsGrid);
      this.loading = this.drawer.querySelector(SELECTORS.loading);
      this.noResults = this.drawer.querySelector(SELECTORS.noResults);
      this.viewAll = this.drawer.querySelector(SELECTORS.viewAll);
      this.viewAllLink = this.drawer.querySelector(SELECTORS.viewAllLink);
      this.liveRegion = this.drawer.querySelector(SELECTORS.liveRegion);

      this.isOpen = false;
      this.abortController = null;
      this.debounceTimer = null;
      this.focusableElements = [];
      this.lastFocusedElement = null;

      this.bindEvents();
    }

    bindEvents() {
      // Open drawer
      if (this.toggle) {
        this.toggle.addEventListener('click', (e) => {
          e.preventDefault();
          this.open();
        });
      }

      // Close drawer
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.close());
      }

      if (this.overlay) {
        this.overlay.addEventListener('click', () => this.close());
      }

      // Escape key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });

      // Search input
      if (this.input) {
        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
      }

      // Form submission
      if (this.form) {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
      }

      // Focus trap
      this.drawer.addEventListener('keydown', (e) => this.handleFocusTrap(e));
    }

    open() {
      this.lastFocusedElement = document.activeElement;
      this.isOpen = true;
      this.drawer.classList.add('is-open');
      document.body.style.overflow = 'hidden';

      if (this.toggle) {
        this.toggle.setAttribute('aria-expanded', 'true');
      }

      // Focus input after animation
      setTimeout(() => {
        this.input.focus();
        this.updateFocusableElements();
      }, 100);
    }

    close() {
      this.isOpen = false;
      this.drawer.classList.remove('is-open');
      document.body.style.overflow = '';

      if (this.toggle) {
        this.toggle.setAttribute('aria-expanded', 'false');
      }

      // Cancel any pending requests
      if (this.abortController) {
        this.abortController.abort();
      }

      // Clear debounce timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Restore focus
      if (this.lastFocusedElement) {
        this.lastFocusedElement.focus();
      }

      // Reset state after animation
      setTimeout(() => {
        this.resetResults();
      }, 300);
    }

    handleInput() {
      const query = this.input.value.trim();

      // Clear existing timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Hide results if query too short
      if (query.length < MIN_QUERY_LENGTH) {
        this.resetResults();
        return;
      }

      // Debounce the search
      this.debounceTimer = setTimeout(() => {
        this.search(query);
      }, DEBOUNCE_DELAY);
    }

    async search(query) {
      // Cancel previous request
      if (this.abortController) {
        this.abortController.abort();
      }

      this.abortController = new AbortController();

      // Show loading state
      this.showLoading();

      try {
        const response = await fetch(
          `/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product,collection&resources[limit]=8`,
          { signal: this.abortController.signal }
        );

        if (!response.ok) {
          throw new Error('Search request failed');
        }

        const data = await response.json();
        this.renderResults(data, query);
      } catch (error) {
        if (error.name === 'AbortError') {
          // Request was cancelled, ignore
          return;
        }
        console.error('Predictive search error:', error);
        this.showNoResults();
      }
    }

    renderResults(data, query) {
      const products = data.resources?.results?.products || [];
      const collections = data.resources?.results?.collections || [];

      this.hideLoading();

      if (products.length === 0 && collections.length === 0) {
        this.showNoResults();
        this.announce('No results found');
        return;
      }

      // Render products
      if (products.length > 0) {
        this.productsGrid.innerHTML = products.map(product => this.renderProduct(product)).join('');
        this.productsGrid.style.display = '';
      } else {
        this.productsGrid.style.display = 'none';
      }

      // Render collections
      if (collections.length > 0) {
        this.collectionsGrid.innerHTML = collections.map(collection => this.renderCollection(collection)).join('');
        this.collectionsGrid.style.display = '';
      } else {
        this.collectionsGrid.style.display = 'none';
      }

      // Show results and view all link
      this.results.style.display = '';
      this.noResults.style.display = 'none';

      // Update view all link
      if (this.viewAllLink) {
        this.viewAllLink.href = `/search?q=${encodeURIComponent(query)}`;
      }
      this.viewAll.style.display = '';

      // Announce results to screen readers
      const totalResults = products.length + collections.length;
      this.announce(`${totalResults} result${totalResults !== 1 ? 's' : ''} found`);

      // Update focusable elements for keyboard navigation
      this.updateFocusableElements();
    }

    renderProduct(product) {
      const image = product.image || product.featured_image?.url || '';
      const price = this.formatMoney(product.price);
      const comparePrice = product.compare_at_price_max > product.price
        ? this.formatMoney(product.compare_at_price_max)
        : null;

      return `
        <a href="${product.url}" class="search-drawer__product">
          <div class="search-drawer__product-image">
            ${image ? `<img src="${this.resizeImage(image, '200x200')}" alt="${this.escapeHtml(product.title)}" loading="lazy">` : ''}
          </div>
          <div class="search-drawer__product-info">
            <h4 class="search-drawer__product-title">${this.highlightMatch(product.title)}</h4>
            <div class="search-drawer__product-price">
              <span class="search-drawer__price${comparePrice ? ' search-drawer__price--sale' : ''}">${price}</span>
              ${comparePrice ? `<span class="search-drawer__compare-price">${comparePrice}</span>` : ''}
            </div>
          </div>
        </a>
      `;
    }

    renderCollection(collection) {
      return `
        <a href="${collection.url}" class="search-drawer__link">
          ${this.escapeHtml(collection.title)}
        </a>
      `;
    }

    formatMoney(cents) {
      if (typeof cents === 'string') {
        cents = parseInt(cents.replace(/[^0-9]/g, ''), 10);
      }
      const dollars = (cents / 100).toFixed(2);
      return `$${dollars}`;
    }

    resizeImage(url, size) {
      if (!url) return '';
      // Shopify image URL transformation
      return url.replace(/\.(jpg|jpeg|png|gif|webp)/, `_${size}.$1`);
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    highlightMatch(text) {
      // Simple escape without highlighting for now
      return this.escapeHtml(text);
    }

    showLoading() {
      this.loading.style.display = '';
      this.results.style.display = 'none';
      this.noResults.style.display = 'none';
      this.viewAll.style.display = 'none';
    }

    hideLoading() {
      this.loading.style.display = 'none';
    }

    showNoResults() {
      this.hideLoading();
      this.results.style.display = 'none';
      this.noResults.style.display = '';
      this.viewAll.style.display = 'none';
    }

    resetResults() {
      this.hideLoading();
      this.results.style.display = 'none';
      this.noResults.style.display = 'none';
      this.viewAll.style.display = 'none';
      this.productsGrid.innerHTML = '';
      this.collectionsGrid.innerHTML = '';
    }

    announce(message) {
      if (this.liveRegion) {
        this.liveRegion.textContent = message;
      }
    }

    handleSubmit(e) {
      const query = this.input.value.trim();
      if (query.length === 0) {
        e.preventDefault();
      }
      // Otherwise let the form submit normally to the search page
    }

    handleKeydown(e) {
      // Arrow down to move focus to first result
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const firstResult = this.results.querySelector('a');
        if (firstResult) {
          firstResult.focus();
        }
      }
    }

    handleFocusTrap(e) {
      if (e.key !== 'Tab') return;

      const focusable = this.getFocusableElements();
      if (focusable.length === 0) return;

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }

    getFocusableElements() {
      return Array.from(this.panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(el => !el.disabled && el.offsetParent !== null);
    }

    updateFocusableElements() {
      this.focusableElements = this.getFocusableElements();
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PredictiveSearch());
  } else {
    new PredictiveSearch();
  }
})();
