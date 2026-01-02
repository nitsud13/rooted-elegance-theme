/**
 * Predictive Search Drawer
 * Slide-down search with live results from Shopify Predictive Search API
 */
(function() {
  'use strict';

  const SELECTORS = {
    toggle: '[data-search-toggle]',
    drawer: '[data-search-drawer]',
    close: '[data-search-drawer-close]',
    input: '[data-search-input]',
    form: '[data-search-form]',
    results: '[data-search-results]',
    resultsContent: '[data-search-results-content]',
    productsSection: '[data-search-products]',
    productsList: '[data-search-products-list]',
    collectionsSection: '[data-search-collections]',
    collectionsList: '[data-search-collections-list]',
    loading: '[data-search-loading]',
    noResults: '[data-search-no-results]',
    noResultsQuery: '[data-search-query]',
    viewAll: '[data-search-view-all]',
    status: '[data-search-status]'
  };

  const DEBOUNCE_DELAY = 300;
  const MIN_QUERY_LENGTH = 2;

  class PredictiveSearch {
    constructor() {
      this.drawer = document.querySelector(SELECTORS.drawer);
      if (!this.drawer) {
        console.log('Search drawer not found');
        return;
      }

      this.toggle = document.querySelector(SELECTORS.toggle);
      this.closeButtons = this.drawer.querySelectorAll(SELECTORS.close);
      this.input = this.drawer.querySelector(SELECTORS.input);
      this.form = this.drawer.querySelector(SELECTORS.form);
      this.results = this.drawer.querySelector(SELECTORS.results);
      this.resultsContent = this.drawer.querySelector(SELECTORS.resultsContent);
      this.productsSection = this.drawer.querySelector(SELECTORS.productsSection);
      this.productsList = this.drawer.querySelector(SELECTORS.productsList);
      this.collectionsSection = this.drawer.querySelector(SELECTORS.collectionsSection);
      this.collectionsList = this.drawer.querySelector(SELECTORS.collectionsList);
      this.loading = this.drawer.querySelector(SELECTORS.loading);
      this.noResults = this.drawer.querySelector(SELECTORS.noResults);
      this.noResultsQuery = this.drawer.querySelector(SELECTORS.noResultsQuery);
      this.viewAll = this.drawer.querySelector(SELECTORS.viewAll);
      this.status = this.drawer.querySelector(SELECTORS.status);

      this.isOpen = false;
      this.abortController = null;
      this.debounceTimer = null;
      this.lastFocusedElement = null;

      this.bindEvents();
      console.log('Predictive search initialized');
    }

    bindEvents() {
      // Open drawer
      if (this.toggle) {
        this.toggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.open();
        });
      }

      // Close drawer - multiple close buttons (overlay + cancel)
      this.closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.close();
        });
      });

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
      this.drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('search-drawer--open');

      if (this.toggle) {
        this.toggle.setAttribute('aria-expanded', 'true');
      }

      // Focus input after animation
      setTimeout(() => {
        if (this.input) {
          this.input.focus();
        }
      }, 100);
    }

    close() {
      this.isOpen = false;
      this.drawer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('search-drawer--open');

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
        if (this.input) {
          this.input.value = '';
        }
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
        this.showNoResults(query);
      }
    }

    renderResults(data, query) {
      const products = data.resources?.results?.products || [];
      const collections = data.resources?.results?.collections || [];

      this.hideLoading();

      if (products.length === 0 && collections.length === 0) {
        this.showNoResults(query);
        this.announce('No results found');
        return;
      }

      // Render products
      if (products.length > 0 && this.productsList) {
        this.productsList.innerHTML = products.map(product => this.renderProduct(product)).join('');
        if (this.productsSection) {
          this.productsSection.hidden = false;
        }
      } else if (this.productsSection) {
        this.productsSection.hidden = true;
      }

      // Render collections
      if (collections.length > 0 && this.collectionsList) {
        this.collectionsList.innerHTML = collections.map(collection => this.renderCollection(collection)).join('');
        if (this.collectionsSection) {
          this.collectionsSection.hidden = false;
        }
      } else if (this.collectionsSection) {
        this.collectionsSection.hidden = true;
      }

      // Hide no results
      if (this.noResults) {
        this.noResults.hidden = true;
      }

      // Update and show view all link
      if (this.viewAll) {
        this.viewAll.href = `/search?q=${encodeURIComponent(query)}`;
        this.viewAll.hidden = false;
      }

      // Announce results to screen readers
      const totalResults = products.length + collections.length;
      this.announce(`${totalResults} result${totalResults !== 1 ? 's' : ''} found`);
    }

    renderProduct(product) {
      const image = product.image || product.featured_image?.url || '';
      const price = this.formatMoney(product.price);
      const comparePrice = product.compare_at_price_max > product.price
        ? this.formatMoney(product.compare_at_price_max)
        : null;

      return `
        <li role="option">
          <a href="${product.url}" class="search-drawer__product">
            <div class="search-drawer__product-image">
              ${image ? `<img src="${this.resizeImage(image, '200x200')}" alt="${this.escapeHtml(product.title)}" loading="lazy">` : ''}
            </div>
            <div class="search-drawer__product-info">
              <h4 class="search-drawer__product-title">${this.escapeHtml(product.title)}</h4>
              <div class="search-drawer__product-price${comparePrice ? ' search-drawer__product-price--sale' : ''}">
                <span>${price}</span>
                ${comparePrice ? `<span class="search-drawer__product-price-compare">${comparePrice}</span>` : ''}
              </div>
            </div>
          </a>
        </li>
      `;
    }

    renderCollection(collection) {
      return `
        <li>
          <a href="${collection.url}" class="search-drawer__link">
            ${this.escapeHtml(collection.title)}
          </a>
        </li>
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

    showLoading() {
      if (this.loading) this.loading.hidden = false;
      if (this.productsSection) this.productsSection.hidden = true;
      if (this.collectionsSection) this.collectionsSection.hidden = true;
      if (this.noResults) this.noResults.hidden = true;
      if (this.viewAll) this.viewAll.hidden = true;
    }

    hideLoading() {
      if (this.loading) this.loading.hidden = true;
    }

    showNoResults(query) {
      this.hideLoading();
      if (this.productsSection) this.productsSection.hidden = true;
      if (this.collectionsSection) this.collectionsSection.hidden = true;
      if (this.noResults) {
        if (this.noResultsQuery) {
          this.noResultsQuery.textContent = query;
        }
        this.noResults.hidden = false;
      }
      if (this.viewAll) this.viewAll.hidden = true;
    }

    resetResults() {
      this.hideLoading();
      if (this.productsSection) this.productsSection.hidden = true;
      if (this.collectionsSection) this.collectionsSection.hidden = true;
      if (this.noResults) this.noResults.hidden = true;
      if (this.viewAll) this.viewAll.hidden = true;
      if (this.productsList) this.productsList.innerHTML = '';
      if (this.collectionsList) this.collectionsList.innerHTML = '';
    }

    announce(message) {
      if (this.status) {
        this.status.textContent = message;
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
        const firstResult = this.resultsContent?.querySelector('a');
        if (firstResult) {
          firstResult.focus();
        }
      }
    }

    handleFocusTrap(e) {
      if (e.key !== 'Tab') return;

      const panel = this.drawer.querySelector('.search-drawer__panel');
      if (!panel) return;

      const focusable = Array.from(panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(el => !el.disabled && !el.hidden && el.offsetParent !== null);

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
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PredictiveSearch());
  } else {
    new PredictiveSearch();
  }
})();
