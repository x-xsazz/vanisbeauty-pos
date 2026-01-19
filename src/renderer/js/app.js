/**
 * VanisBeauty POS - Main Application
 * Touch-first, state-driven POS system
 */

(function() {
  'use strict';

  // DOM Elements Cache
  const DOM = {
    // Views
    posView: document.getElementById('pos-view'),
    adminView: document.getElementById('admin-view'),

    // Services Panel
    categoryNav: document.getElementById('category-nav'),
    servicesGrid: document.getElementById('services-grid'),
    logoBtn: document.getElementById('logo-btn'),

    // Staff (moved to center panel top)
    staffChips: document.getElementById('staff-chips'),
    staffSelectedName: document.getElementById('staff-selected-name'),

    // Bill Panel
    billItems: document.getElementById('bill-items'),
    clearBillBtn: document.getElementById('clear-bill-btn'),

    // Checkout Panel - Customer Lookup
    customerLookupInput: document.getElementById('customer-lookup-input'),
    customerLookupBtn: document.getElementById('customer-lookup-btn'),
    customerInfo: document.getElementById('customer-info'),
    customerDropdown: document.getElementById('customer-dropdown'),
    customerDropdownList: document.getElementById('customer-dropdown-list'),
    customerDropdownEmpty: document.getElementById('customer-dropdown-empty'),
    customerDropdownAdd: document.getElementById('customer-dropdown-add'),
    customerLookupContainer: document.getElementById('customer-lookup'),

    // Checkout Panel - Totals
    subtotal: document.getElementById('subtotal'),
    discountRow: document.getElementById('discount-row'),
    discountAmount: document.getElementById('discount-amount'),
    total: document.getElementById('total'),
    addDiscountBtn: document.getElementById('add-discount-btn'),

    // Checkout Panel - Payment
    payCashBtn: document.getElementById('pay-cash-btn'),
    payCardBtn: document.getElementById('pay-card-btn'),
    payPayIDBtn: document.getElementById('pay-payid-btn'),
    payCreditBtn: document.getElementById('pay-credit-btn'),
    adminBtn: document.getElementById('admin-btn'),

    // Modal
    modalOverlay: document.getElementById('modal-overlay'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalClose: document.getElementById('modal-close'),

    // Admin
    adminContent: document.getElementById('admin-content'),
    exitAdminBtn: document.getElementById('exit-admin-btn'),
    adminNavBtns: document.querySelectorAll('.admin-nav-btn'),

    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  // Currency formatter
  let currencySymbol = '$';
  const formatCurrency = (amount) => `${currencySymbol}${parseFloat(amount).toFixed(2)}`;
  let reportsSelectedDate = getLocalDateString();

  const customerSearchState = {
    query: '',
    results: [],
    activeIndex: -1
  };

  let reportsTimerInterval = null;

  // ============================================
  // INITIALIZATION
  // ============================================

  async function initApp() {
    try {
      // Load settings
      const settingsResult = await window.api.settings.getAll();
      if (settingsResult.success) {
        store.setState({ settings: settingsResult.data });
        currencySymbol = settingsResult.data.currency_symbol || '$';
      }

      // Load initial data in parallel
      const [servicesResult, categoriesResult, staffResult] = await Promise.all([
        window.api.services.getAll(),
        window.api.categories.getAll(),
        window.api.staff.getAll()
      ]);

      if (servicesResult.success) {
        store.setState({ services: servicesResult.data });
      }

      if (categoriesResult.success) {
        store.setState({ categories: categoriesResult.data });
      }

      if (staffResult.success) {
        store.setState({ staff: staffResult.data });
      }

      // Set up event listeners
      setupEventListeners();

      // Subscribe to state changes
      setupSubscriptions();

      // Initial render
      renderCategories();
      renderServices();
      renderStaff();
      renderBillItems();
      updateTotals();
      renderCustomerInfo();
      goHome();

    } catch (error) {
      console.error('Failed to initialize app:', error);
      showToast('Failed to initialize application', 'error');
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  function setupEventListeners() {
    // Category selection
    DOM.categoryNav.addEventListener('click', (e) => {
      if (e.target.classList.contains('category-btn-vertical')) {
        const category = e.target.dataset.category;
        store.setState({ selectedCategory: category });
        renderCategories();
        renderServices();
      }
    });

    // Clear bill
    if (DOM.clearBillBtn) {
      DOM.clearBillBtn.addEventListener('click', () => {
        if (store.getState().currentBill.items.length > 0) {
          openModal('confirm', {
            title: 'Clear Bill',
            message: 'Are you sure you want to clear the current bill?',
            onConfirm: () => {
              store.clearBill();
              closeModal();
              showToast('Bill cleared', 'info');
            }
          });
        }
      });
    }

    // Discount button
    DOM.addDiscountBtn.addEventListener('click', () => {
      if (store.getState().currentBill.items.length > 0) {
        openModal('discount');
      }
    });

    // Customer lookup dropdown
    const debouncedCustomerSearch = debounce(() => {
      performCustomerSearch(false);
    }, 150);

    DOM.customerLookupInput.addEventListener('input', () => {
      debouncedCustomerSearch();
    });

    DOM.customerLookupInput.addEventListener('keydown', (e) => {
      handleCustomerDropdownKeydown(e);
    });

    DOM.customerLookupBtn.addEventListener('click', () => {
      window.api.modals.openCustomerLookup();
    });

    DOM.customerDropdownAdd?.addEventListener('click', () => {
      const query = DOM.customerLookupInput.value.trim();
      openModal('newCustomer', { prefillQuery: query });
    });

    document.addEventListener('click', (e) => {
      if (!DOM.customerLookupContainer?.contains(e.target)) {
        closeCustomerDropdown();
      }
    });

    // Payment buttons
    DOM.payCashBtn.addEventListener('click', () => openModal('payment', { method: 'cash' }));
    DOM.payCardBtn.addEventListener('click', () => openModal('payment', { method: 'card' }));
    DOM.payPayIDBtn.addEventListener('click', () => openModal('payment', { method: 'payid' }));
    DOM.payCreditBtn.addEventListener('click', () => openModal('payment', { method: 'credit' }));

    // Admin button (removed from UI, now using logo)
    if (DOM.adminBtn) {
      DOM.adminBtn.addEventListener('click', () => {
        window.api.modals.openPinKeypad({ type: 'admin' });
      });
    }

    // Logo click to open admin
    const logoSection = document.querySelector('.logo-section');
    if (logoSection) {
      logoSection.addEventListener('click', () => {
        window.api.modals.openPinKeypad({ type: 'admin' });
      });
    }

    // Modal window event listeners
    window.api.modals.onCustomerSelected((customer) => {
      store.setCustomer(customer);
      DOM.customerLookupInput.value = '';
      closeCustomerDropdown();
      renderCustomerInfo();
    });

    window.api.modals.onPinVerified((data) => {
      if (data.type === 'admin') {
        store.setView('admin');
        store.setAdminAuthenticated(true);
        renderAdminServices();
      }
    });

    window.api.modals.onAddCustomerFromLookup(() => {
      openModal('newCustomer', {});
    });

    // Modal close
    DOM.modalClose.addEventListener('click', closeModal);
    DOM.modalOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.modalOverlay) {
        closeModal();
      }
    });

    // Admin navigation
    DOM.adminNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        DOM.adminNavBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderAdminSection(section);
      });
    });

    // Exit admin
    DOM.exitAdminBtn.addEventListener('click', () => {
      goHome();
      store.setView('pos');
      store.setAdminAuthenticated(false);
      stopReportsTimer();
    });
  }

  // ============================================
  // STATE SUBSCRIPTIONS
  // ============================================

  function setupSubscriptions() {
    // View changes
    store.subscribe((state) => {
      DOM.posView.classList.toggle('active', state.currentView === 'pos');
      DOM.adminView.classList.toggle('active', state.currentView === 'admin');
    }, ['currentView']);

    // Bill changes
    store.subscribe(() => {
      renderBillItems();
      updateTotals();
      updatePaymentButtons();
    }, ['currentBill']);

    // Staff selection
    store.subscribe(() => {
      renderStaff();
    }, ['selectedStaff', 'staff']);
  }

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  function renderCategories() {
    const { categories, selectedCategory } = store.getState();

    // Render vertical category buttons
    const categoryList = categories
      .filter(cat => cat.name.toUpperCase() !== 'HOME')
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    const categoriesWithHome = [{ name: 'HOME' }, ...categoryList];
    
    // Use same color logic as admin reports
    const categoryPalette = ['#085578', '#538085', '#faf1e2', '#e3baaa', '#e47e8c', '#ffaa6a'];

    const categoryBtns = categoriesWithHome.map((cat, index) => {
      // HOME gets special color, rest use palette (same as reports)
      const bgColor = index === 0 ? '#b8cdab' : categoryPalette[(index - 1) % categoryPalette.length];
      const textColor = getTextColorForBackground(bgColor);
      return `
        <button class="category-btn-vertical ${selectedCategory === cat.name ? 'active' : ''}" data-category="${cat.name}" style="--cat-color: ${bgColor}; --cat-text-color: ${textColor};">
          ${cat.name === 'HOME' ? 'Home' : cat.name}
        </button>
      `;
    }).join('');

    DOM.categoryNav.innerHTML = categoryBtns;
  }

  function renderServices() {
    const { services, selectedCategory } = store.getState();

    let filtered = services;

    // Filter by category
    if (selectedCategory === 'HOME') {
      // HOME only shows services marked to show on home
      filtered = filtered.filter(s => s.show_on_home === 1);
    } else {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }

    if (filtered.length === 0) {
      DOM.servicesGrid.innerHTML = `
        <div class="empty-bill" style="grid-column: span 2;">
          <p>No services found</p>
        </div>
      `;
      return;
    }

    DOM.servicesGrid.innerHTML = filtered.map(service => `
      <button class="service-btn" data-service-id="${service.id}">
        <span class="service-name">${service.name}</span>
        <span class="service-price">${formatCurrency(service.price)}</span>
      </button>
    `).join('');

    // Add click handlers with MANDATORY staff selection validation
    DOM.servicesGrid.querySelectorAll('.service-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedStaff = store.getState().selectedStaff;

        // VALIDATION: Staff must be selected before adding items
        if (!selectedStaff) {
          showToast('Please select a staff member first', 'error');
          return;
        }

        const serviceId = parseInt(btn.dataset.serviceId);
        const service = services.find(s => s.id === serviceId);
        if (service) {
          store.addItemToBill(service, selectedStaff);
          showToast(`Added ${service.name}`, 'success');
        }
      });
    });
  }

  function renderStaff() {
    const { staff, selectedStaff } = store.getState();
    const activeStaff = staff.filter(s => s.role !== 'admin');

    // Always render 5 staff picture boxes
    const staffBoxes = [];
    for (let i = 0; i < 5; i++) {
      const staffMember = activeStaff[i];
      if (staffMember) {
        const photoUrl = staffMember.photo_path ? toFileUrl(staffMember.photo_path) : '';
        const photoMarkup = photoUrl
          ? `<img class="staff-photo" src="${photoUrl}" alt="${staffMember.name}">`
          : `<span class="staff-initial">${staffMember.name.charAt(0)}</span>`;

        staffBoxes.push(`
          <button class="staff-picture-box ${selectedStaff?.id === staffMember.id ? 'active' : ''}" data-staff-id="${staffMember.id}">
            <div class="staff-picture-placeholder">
              ${photoMarkup}
            </div>
            <div class="staff-picture-name">${staffMember.name}</div>
          </button>
        `);
      } else {
        // Empty placeholder
        staffBoxes.push(`
          <button class="staff-picture-box empty" disabled>
            <div class="staff-picture-placeholder">
              <span class="staff-initial">+</span>
            </div>
            <div class="staff-picture-name">Staff ${i + 1}</div>
          </button>
        `);
      }
    }

    DOM.staffChips.innerHTML = staffBoxes.join('');

    if (DOM.staffSelectedName) {
      DOM.staffSelectedName.textContent = selectedStaff ? selectedStaff.name : 'None';
    }

    // Click to select; long-press to open clock menu.
    DOM.staffChips.querySelectorAll('.staff-picture-box:not(.empty)').forEach(box => {
      let longPressTimer = null;
      let longPressTriggered = false;
      const supportsPointer = typeof window.PointerEvent !== 'undefined';

      const clearLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };

      const startLongPress = () => {
        longPressTriggered = false;
        clearLongPress();
        longPressTimer = setTimeout(() => {
          longPressTriggered = true;
          const staffId = parseInt(box.dataset.staffId);
          const staffMember = staff.find(s => s.id === staffId);
          if (staffMember) {
            openModal('staffClock', { staff: staffMember });
          }
        }, 600);
      };

      if (supportsPointer) {
        box.addEventListener('pointerdown', startLongPress);
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
          box.addEventListener(evt, clearLongPress);
        });
      } else {
        box.addEventListener('mousedown', startLongPress);
        box.addEventListener('touchstart', startLongPress, { passive: true });
        ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => {
          box.addEventListener(evt, clearLongPress);
        });
      }

      box.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });

      box.addEventListener('click', () => {
        if (longPressTriggered) {
          return;
        }
        const staffId = parseInt(box.dataset.staffId);
        const current = store.getState().selectedStaff;
        if (current?.id === staffId) {
          store.setState({ selectedStaff: null });
        } else {
          const staffMember = staff.find(s => s.id === staffId);
          store.setState({ selectedStaff: staffMember });
        }
      });
    });
  }

  function renderBillItems() {
    const { currentBill } = store.getState();

    if (currentBill.items.length === 0) {
      DOM.billItems.innerHTML = `
        <div class="empty-checkout">
          <p>Tap services to add to bill</p>
        </div>
      `;
      return;
    }

    DOM.billItems.innerHTML = currentBill.items.map(item => `
      <div class="bill-item" data-item-id="${item.id}">
        <div class="bill-item-info">
          <div class="bill-item-name">${item.service_name}</div>
          ${item.staff_name ? `<div class="bill-item-staff">by ${item.staff_name}</div>` : ''}
        </div>
        <div class="bill-item-qty">
          <button class="qty-btn" data-action="decrease">-</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" data-action="increase">+</button>
        </div>
        <div class="bill-item-price">${formatCurrency(item.price * item.quantity)}</div>
        <button class="bill-item-remove" data-action="remove">&times;</button>
      </div>
    `).join('');

    // Add event handlers
    DOM.billItems.querySelectorAll('.bill-item').forEach(itemEl => {
      const itemId = parseInt(itemEl.dataset.itemId);

      itemEl.querySelector('[data-action="decrease"]').addEventListener('click', () => {
        store.updateItemQuantity(itemId, -1);
      });

      itemEl.querySelector('[data-action="increase"]').addEventListener('click', () => {
        store.updateItemQuantity(itemId, 1);
      });

      itemEl.querySelector('[data-action="remove"]').addEventListener('click', () => {
        store.removeItemFromBill(itemId);
      });
    });
  }

  function updateTotals() {
    const { currentBill } = store.getState();

    DOM.subtotal.textContent = formatCurrency(currentBill.subtotal);
    DOM.total.textContent = formatCurrency(currentBill.total);

    if (currentBill.discountAmount > 0) {
      DOM.discountRow.style.display = 'flex';
      DOM.discountAmount.textContent = `-${formatCurrency(currentBill.discountAmount)}`;
    } else {
      DOM.discountRow.style.display = 'none';
    }
  }

  function updatePaymentButtons() {
    const { currentBill } = store.getState();
    const hasItems = currentBill.items.length > 0;

    DOM.payCashBtn.disabled = !hasItems;
    DOM.payCardBtn.disabled = !hasItems;
    DOM.payPayIDBtn.disabled = !hasItems;
    DOM.payCreditBtn.disabled = !hasItems;
  }

  function renderCustomerInfo() {
    const { currentBill } = store.getState();
    const customer = currentBill.customer;

    if (customer) {
      // Display selected customer
      DOM.customerInfo.innerHTML = `
        <div class="customer-card">
          <div class="customer-avatar">${customer.name.charAt(0).toUpperCase()}</div>
          <div class="customer-details">
            <div class="customer-name">${customer.name}</div>
            <div class="customer-meta">${customer.phone || 'No phone'} • ${customer.visits || 0} visits</div>
          </div>
          ${customer.loyalty_points > 0 ? `
            <div class="customer-loyalty">
              <span>★</span>
              <span>${customer.loyalty_points} pts</span>
            </div>
          ` : ''}
        </div>
        <button class="btn btn-outline btn-block" id="remove-customer-btn">Remove Customer</button>
      `;

      document.getElementById('remove-customer-btn')?.addEventListener('click', () => {
        store.setCustomer(null);
        DOM.customerLookupInput.value = '';
        closeCustomerDropdown();
        renderCustomerInfo();
      });
    } else {
      // No customer selected - show nothing (input field is always visible)
      DOM.customerInfo.innerHTML = '';
    }
  }

  // ============================================
  // MODAL SYSTEM
  // ============================================

  function openModal(modalType, data = {}) {
    store.openModal(modalType, data);

    const modalContent = getModalContent(modalType, data);
    DOM.modalTitle.textContent = modalContent.title;
    DOM.modalBody.innerHTML = modalContent.body;

    // Set up modal-specific handlers
    if (modalContent.onMount) {
      modalContent.onMount();
    }

    DOM.modalOverlay.classList.add('active');
  }

  function closeModal() {
    DOM.modalOverlay.classList.remove('active');
    store.closeModal();
  }

  function getModalContent(type, data) {
    switch (type) {
      case 'customerLookup':
        // NEW: Customer Lookup Modal - search by name or mobile
        return {
          title: 'Customer Lookup',
          body: `
            <div id="customer-lookup-results" class="customer-search-results"></div>
            <div class="mt-md text-center" id="no-customer-found" style="display: none;">
              <p class="text-muted mb-md">No existing customer found</p>
              <button class="btn btn-primary" id="add-new-customer-btn">Add New Customer</button>
            </div>
          `,
          onMount: async () => {
            const resultsDiv = document.getElementById('customer-lookup-results');
            const noCustomerDiv = document.getElementById('no-customer-found');
            const query = data.query;

            // Search for customer
            const result = await window.api.customers.search(query);

            if (result.success && result.data.length > 0) {
              // Show matching customers
              resultsDiv.innerHTML = result.data.map(c => `
                <div class="customer-result" data-customer-id="${c.id}">
                  <strong>${c.name}</strong>
                  <span>${c.phone || 'No phone'}</span>
                  ${c.loyalty_points > 0 ? `<span class="text-success">${c.loyalty_points} pts</span>` : ''}
                </div>
              `).join('');

              resultsDiv.querySelectorAll('.customer-result').forEach(el => {
                el.addEventListener('click', async () => {
                  const customerId = parseInt(el.dataset.customerId);
                  const customerResult = await window.api.customers.get(customerId);
                  if (customerResult.success) {
                    store.setCustomer(customerResult.data);
                    DOM.customerLookupInput.value = customerResult.data.name;
                    renderCustomerInfo();
                    closeModal();
                  }
                });
              });
            } else {
              // No customer found
              resultsDiv.innerHTML = '';
              noCustomerDiv.style.display = 'block';
            }

            // Add New Customer button
            document.getElementById('add-new-customer-btn')?.addEventListener('click', () => {
              openModal('newCustomer', { prefillQuery: query });
            });
          }
        };

      case 'newCustomer':
        // NEW: Updated to include Credit field
        const prefillQuery = data?.prefillQuery || '';
        const isPhone = /^\d+$/.test(prefillQuery);

        return {
          title: 'New Customer',
          body: `
            <div class="form-group">
              <label class="form-label">Name *</label>
              <input type="text" class="form-input" id="new-customer-name" placeholder="Customer name" value="${!isPhone ? prefillQuery : ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Mobile Number *</label>
              <input type="tel" class="form-input" id="new-customer-phone" placeholder="Mobile number" value="${isPhone ? prefillQuery : ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" id="new-customer-email" placeholder="Email address">
            </div>
            <div class="form-group">
              <label class="form-label">Credit</label>
              <input type="number" class="form-input" id="new-customer-credit" placeholder="0.00" min="0" step="0.01" value="0">
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="cancel-new-customer">Cancel</button>
              <button class="btn btn-primary" id="save-new-customer">Save Customer</button>
            </div>
          `,
          onMount: () => {
            document.getElementById('cancel-new-customer').addEventListener('click', closeModal);

            document.getElementById('save-new-customer').addEventListener('click', async () => {
              const name = document.getElementById('new-customer-name').value.trim();
              const phone = document.getElementById('new-customer-phone').value.trim();
              const email = document.getElementById('new-customer-email').value.trim();
              const credit = parseFloat(document.getElementById('new-customer-credit').value) || 0;

              if (!name) {
                showToast('Customer name is required', 'error');
                return;
              }

              if (!phone) {
                showToast('Mobile number is required', 'error');
                return;
              }

              const result = await window.api.customers.create({ name, phone, email, notes: `Credit: ${credit}` });
              if (result.success) {
                store.setCustomer(result.data);
                DOM.customerLookupInput.value = result.data.name;
                renderCustomerInfo();
                closeModal();
                showToast('Customer added', 'success');
              } else {
                showToast(result.error || 'Failed to create customer', 'error');
              }
            });

            document.getElementById('new-customer-name').focus();
          }
        };

      case 'discount':
        // NEW: Enter final amount - discount = subtotal - final amount
        const { currentBill } = store.getState();
        const subtotal = currentBill.subtotal;

        return {
          title: 'Enter Final Amount',
          body: `
            <div class="text-center mb-md">
              <div class="stat-label">Current Subtotal</div>
              <div class="stat-value">${formatCurrency(subtotal)}</div>
            </div>
            <div class="form-group">
              <label class="form-label">Final Amount *</label>
              <input type="number" class="form-input" id="final-amount-input" placeholder="0.00" min="0" step="0.01" value="${subtotal}">
            </div>
            <div class="form-group">
              <div class="stat-label">Discount Amount</div>
              <div id="calculated-discount" class="text-success">${formatCurrency(0)}</div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="clear-discount">Clear Discount</button>
              <button class="btn btn-primary" id="apply-final-amount">Apply</button>
            </div>
          `,
          onMount: () => {
            const input = document.getElementById('final-amount-input');
            const discountDisplay = document.getElementById('calculated-discount');

            // Update discount calculation when final amount changes
            input.addEventListener('input', () => {
              const finalAmount = parseFloat(input.value) || 0;
              const discount = Math.max(0, subtotal - finalAmount);
              discountDisplay.textContent = formatCurrency(discount);
            });

            document.getElementById('clear-discount').addEventListener('click', () => {
              store.setDiscount(0, 'fixed');
              closeModal();
            });

            document.getElementById('apply-final-amount').addEventListener('click', () => {
              const finalAmount = parseFloat(input.value) || 0;

              if (finalAmount < 0) {
                showToast('Final amount cannot be negative', 'error');
                return;
              }

              if (finalAmount > subtotal) {
                showToast('Final amount cannot exceed subtotal', 'error');
                return;
              }

              const discountAmount = subtotal - finalAmount;
              store.setDiscount(discountAmount, 'fixed');
              closeModal();
              showToast('Discount applied', 'success');
            });

            input.focus();
            input.select();
          }
        };

      case 'payment':
        const currentBillPayment = store.getState().currentBill;
        const methodLabels = { cash: 'Cash', card: 'Card', payid: 'Pay ID', credit: 'Credit' };

        return {
          title: `Payment - ${methodLabels[data.method]}`,
          body: `
            <div class="text-center mb-md">
              <div class="stat-value">${formatCurrency(currentBillPayment.total)}</div>
              <div class="text-muted">Total Amount</div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="cancel-payment">Cancel</button>
              <button class="btn btn-success" id="confirm-payment">Complete Payment</button>
            </div>
          `,
          onMount: () => {
            document.getElementById('cancel-payment').addEventListener('click', closeModal);

            document.getElementById('confirm-payment').addEventListener('click', async () => {
              const billData = {
                customer_id: currentBillPayment.customer?.id || null,
                subtotal: currentBillPayment.subtotal,
                discount_amount: currentBillPayment.discountAmount,
                discount_type: currentBillPayment.discountType,
                total: currentBillPayment.total,
                payment_method: data.method,
                items: currentBillPayment.items.map(item => ({
                  service_id: item.service_id,
                  service_name: item.service_name,
                  price: item.price,
                  quantity: item.quantity,
                  staff_id: item.staff_id,
                  staff_name: item.staff_name
                }))
              };

              const result = await window.api.bills.create(billData);
              if (result.success) {
                closeModal();
                store.clearBill();
                DOM.customerLookupInput.value = '';
                renderCustomerInfo();
                goHome();
                showToast(`Payment completed - Bill #${result.data.id}`, 'success');
              } else {
                showToast(result.error || 'Payment failed', 'error');
              }
            });
          }
        };

      case 'adminPin':
        return {
          title: 'Admin Access',
          body: `
            <p class="text-center text-muted mb-md">Enter 5-digit admin PIN</p>
            <div class="pin-input-group">
              <input type="password" class="pin-digit" maxlength="1" data-index="0">
              <input type="password" class="pin-digit" maxlength="1" data-index="1">
              <input type="password" class="pin-digit" maxlength="1" data-index="2">
              <input type="password" class="pin-digit" maxlength="1" data-index="3">
              <input type="password" class="pin-digit" maxlength="1" data-index="4">
            </div>
            <p id="pin-error" class="text-danger text-center" style="display: none;">Invalid PIN</p>
          `,
          onMount: () => {
            const digits = document.querySelectorAll('.pin-digit');
            const errorMsg = document.getElementById('pin-error');

            digits.forEach((input, index) => {
              input.addEventListener('input', async () => {
                // Add filled class
                input.classList.toggle('filled', input.value.length > 0);

                if (input.value.length === 1 && index < 4) {
                  digits[index + 1].focus();
                }

                // Check if all 5 digits are entered
                const pin = Array.from(digits).map(d => d.value).join('');
                if (pin.length === 5) {
                  const result = await window.api.admin.verifyPin(pin);
                  if (result.success && result.data.valid) {
                    store.setAdminAuthenticated(true);
                    store.setView('admin');
                    closeModal();
                    renderAdminSection('services');
                  } else {
                    errorMsg.style.display = 'block';
                    digits.forEach(d => {
                      d.value = '';
                      d.classList.remove('filled');
                    });
                    digits[0].focus();
                  }
                }
              });

              input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && index > 0) {
                  digits[index - 1].focus();
                }
              });
            });

            setTimeout(() => {
              digits[0].focus();
            }, 0);
          }
        };

      case 'staffClock':
        return {
          title: 'Staff Clock',
          body: `
            <div class="staff-clock-card">
              <div class="staff-clock-name">${data.staff?.name || 'Staff'}</div>
              <div class="staff-clock-row">
                <span>Clock in</span>
                <span id="staff-clock-in">--</span>
              </div>
              <div class="staff-clock-row">
                <span>Clock out</span>
                <span id="staff-clock-out">--</span>
              </div>
              <div class="staff-clock-row">
                <span>Total time</span>
                <span id="staff-clock-total">--</span>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="staff-clock-cancel">Cancel</button>
              <button class="btn btn-primary" id="staff-clock-action">Clock In</button>
            </div>
          `,
          onMount: async () => {
            const staffMember = data.staff;
            if (!staffMember) {
              return;
            }

            const date = getLocalDateString();
            const statusResult = await window.api.staff.clockStatus(staffMember.id, date);
            if (!statusResult.success) {
              showToast(statusResult.error || 'Failed to load clock status', 'error');
              return;
            }

            const status = statusResult.data || {};
            const clockInEl = document.getElementById('staff-clock-in');
            const clockOutEl = document.getElementById('staff-clock-out');
            const totalEl = document.getElementById('staff-clock-total');
            const actionBtn = document.getElementById('staff-clock-action');
            const cancelBtn = document.getElementById('staff-clock-cancel');

            if (clockInEl) {
              clockInEl.textContent = status.firstClockIn ? formatTime(status.firstClockIn) : '--';
            }
            if (clockOutEl) {
              clockOutEl.textContent = status.lastClockOut ? formatTime(status.lastClockOut) : '--';
            }

            if (totalEl) {
              totalEl.textContent = status.openLog ? 'In progress' : '--';
            }

            const hasOpenLog = Boolean(status.openLog?.id);
            if (actionBtn) {
              actionBtn.textContent = hasOpenLog ? 'Clock Out' : 'Clock In';
              actionBtn.addEventListener('click', async () => {
                if (hasOpenLog) {
                  const result = await window.api.staff.clockOut(status.openLog.id);
                  if (!result.success) {
                    showToast(result.error || 'Clock out failed', 'error');
                    return;
                  }
                  showToast(`${staffMember.name} clocked out`, 'success');
                } else {
                  const result = await window.api.staff.clockIn(staffMember.id);
                  if (!result.success) {
                    showToast(result.error || 'Clock in failed', 'error');
                    return;
                  }
                  showToast(`${staffMember.name} clocked in`, 'success');
                }
                closeModal();
              });
            }

            cancelBtn?.addEventListener('click', closeModal);
          }
        };

      case 'confirm':
        return {
          title: data.title || 'Confirm',
          body: `
            <p class="text-center mb-md">${data.message || 'Are you sure?'}</p>
            <div class="modal-footer">
              <button class="btn btn-outline" id="confirm-cancel">Cancel</button>
              <button class="btn btn-danger" id="confirm-ok">Confirm</button>
            </div>
          `,
          onMount: () => {
            document.getElementById('confirm-cancel').addEventListener('click', closeModal);
            document.getElementById('confirm-ok').addEventListener('click', () => {
              if (data.onConfirm) data.onConfirm();
            });
          }
        };

      // Admin modals
      case 'addService':
        return {
          title: 'Add Service',
          body: `
            <div class="form-group">
              <label class="form-label">Service Name *</label>
              <input type="text" class="form-input" id="service-name" placeholder="Service name">
            </div>
            <div class="form-group">
              <label class="form-label">Price *</label>
              <input type="number" class="form-input" id="service-price" placeholder="0.00" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label class="form-label">Category *</label>
              <select class="form-input" id="service-category">
                ${['HOME', ...store.getState().categories.map(c => c.name)]
                  .filter((value, index, arr) => arr.indexOf(value) === index)
                  .map(name => `<option value="${name}">${name}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Show on Home</label>
              <label class="form-checkbox">
                <input type="checkbox" id="service-show-home">
                <span>Display on Home screen</span>
              </label>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="cancel-add-service">Cancel</button>
              <button class="btn btn-primary" id="save-add-service">Add Service</button>
            </div>
          `,
          onMount: () => {
            document.getElementById('cancel-add-service').addEventListener('click', closeModal);

            document.getElementById('save-add-service').addEventListener('click', async () => {
              const name = document.getElementById('service-name').value.trim();
              const price = parseFloat(document.getElementById('service-price').value);
              const category = document.getElementById('service-category').value;
              const show_on_home = document.getElementById('service-show-home').checked ? 1 : 0;

              if (!name) {
                showToast('Service name is required', 'error');
                return;
              }
              if (isNaN(price) || price < 0) {
                showToast('Valid price is required', 'error');
                return;
              }

              const result = await window.api.services.create({ name, price, category, show_on_home, active: 1 });
              if (result.success) {
                closeModal();
                showToast('Service added', 'success');
                await refreshServices();
                renderAdminSection('services');
              } else {
                showToast(result.error || 'Failed to add service', 'error');
              }
            });

            document.getElementById('service-name').focus();
          }
        };

      case 'editService':
        return {
          title: 'Edit Service',
          body: `
            <div class="form-group">
              <label class="form-label">Service Name *</label>
              <input type="text" class="form-input" id="service-name" value="${data.service.name}">
            </div>
            <div class="form-group">
              <label class="form-label">Price *</label>
              <input type="number" class="form-input" id="service-price" value="${data.service.price}" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label class="form-label">Category *</label>
              <select class="form-input" id="service-category">
                ${['HOME', ...store.getState().categories.map(c => c.name)]
                  .filter((value, index, arr) => arr.indexOf(value) === index)
                  .map(name =>
                    `<option value="${name}" ${name === data.service.category ? 'selected' : ''}>${name}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Show on Home</label>
              <label class="form-checkbox">
                <input type="checkbox" id="service-show-home" ${data.service.show_on_home ? 'checked' : ''}>
                <span>Display on Home screen</span>
              </label>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="cancel-edit-service">Cancel</button>
              <button class="btn btn-primary" id="save-edit-service">Save Changes</button>
            </div>
          `,
          onMount: () => {
            document.getElementById('cancel-edit-service').addEventListener('click', closeModal);

            document.getElementById('save-edit-service').addEventListener('click', async () => {
              const name = document.getElementById('service-name').value.trim();
              const price = parseFloat(document.getElementById('service-price').value);
              const category = document.getElementById('service-category').value;
              const show_on_home = document.getElementById('service-show-home').checked ? 1 : 0;

              if (!name || isNaN(price) || price < 0) {
                showToast('Please fill all required fields', 'error');
                return;
              }

              const result = await window.api.services.update(data.service.id, { name, price, category, show_on_home });
              if (result.success) {
                closeModal();
                showToast('Service updated', 'success');
                await refreshServices();
                renderAdminSection('services');
              } else {
                showToast(result.error || 'Failed to update service', 'error');
              }
            });
          }
        };

      case 'addCategory':
        return {
          title: 'Add Category',
          body: `
            <div class="form-group">
              <label class="form-label">Category Name *</label>
              <input type="text" class="form-input" id="category-name" placeholder="Category name">
            </div>
            <div class="form-group">
              <label class="form-label">Display Order</label>
              <input type="number" class="form-input" id="category-order" placeholder="0" min="0" value="0">
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="cancel-add-cat">Cancel</button>
              <button class="btn btn-primary" id="save-add-cat">Add Category</button>
            </div>
          `,
          onMount: () => {
            document.getElementById('cancel-add-cat').addEventListener('click', closeModal);

            document.getElementById('save-add-cat').addEventListener('click', async () => {
              const name = document.getElementById('category-name').value.trim();
              const display_order = parseInt(document.getElementById('category-order').value) || 0;

              if (!name) {
                showToast('Category name is required', 'error');
                return;
              }

              const result = await window.api.categories.create({ name, display_order });
              if (result.success) {
                closeModal();
                showToast('Category added', 'success');
                await refreshCategories();
                renderAdminSection('categories');
              } else {
                showToast(result.error || 'Failed to add category', 'error');
              }
            });

            document.getElementById('category-name').focus();
          }
        };

      case 'addStaff':
        return {
          title: 'Add Staff',
          body: `
            <div class="form-group">
              <label class="form-label">Name *</label>
              <input type="text" class="form-input" id="staff-name" placeholder="Staff name">
            </div>
            <div class="form-group">
              <label class="form-label">Role</label>
              <select class="form-input" id="staff-role">
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Photo</label>
              <div class="staff-photo-picker">
                <div class="staff-photo-preview" id="staff-photo-preview">No photo</div>
                <div class="staff-photo-actions">
                  <button class="btn btn-outline" id="staff-photo-btn" type="button">Choose Photo</button>
                  <button class="btn btn-outline" id="staff-photo-clear" type="button" disabled>Clear</button>
                </div>
              </div>
              <input type="hidden" id="staff-photo-path" value="">
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="cancel-add-staff">Cancel</button>
              <button class="btn btn-primary" id="save-add-staff">Add Staff</button>
            </div>
          `,
          onMount: () => {
            document.getElementById('cancel-add-staff').addEventListener('click', closeModal);

            document.getElementById('save-add-staff').addEventListener('click', async () => {
              const name = document.getElementById('staff-name').value.trim();
              const role = document.getElementById('staff-role').value;
              const photo_path = document.getElementById('staff-photo-path').value || null;

              if (!name) {
                showToast('Staff name is required', 'error');
                return;
              }

              const result = await window.api.staff.create({ name, commission_rate: 0, role, photo_path, active: 1 });
              if (result.success) {
                closeModal();
                showToast('Staff added', 'success');
                await refreshStaff();
                renderAdminSection('staff');
              } else {
                showToast(result.error || 'Failed to add staff', 'error');
              }
            });

            initStaffPhotoPicker('');
            document.getElementById('staff-name').focus();
          }
        };

      case 'editStaff':
        return {
          title: 'Edit Staff',
          body: `
            <div class="form-group">
              <label class="form-label">Name *</label>
              <input type="text" class="form-input" id="staff-name" value="${data.staff.name}">
            </div>
            <div class="form-group">
              <label class="form-label">Role</label>
              <select class="form-input" id="staff-role">
                <option value="staff" ${data.staff.role === 'staff' ? 'selected' : ''}>Staff</option>
                <option value="admin" ${data.staff.role === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Photo</label>
              <div class="staff-photo-picker">
                <div class="staff-photo-preview" id="staff-photo-preview">No photo</div>
                <div class="staff-photo-actions">
                  <button class="btn btn-outline" id="staff-photo-btn" type="button">Choose Photo</button>
                  <button class="btn btn-outline" id="staff-photo-clear" type="button" disabled>Clear</button>
                </div>
              </div>
              <input type="hidden" id="staff-photo-path" value="">
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="cancel-edit-staff">Cancel</button>
              <button class="btn btn-primary" id="save-edit-staff">Save Changes</button>
            </div>
          `,
          onMount: () => {
            document.getElementById('cancel-edit-staff').addEventListener('click', closeModal);

            document.getElementById('save-edit-staff').addEventListener('click', async () => {
              const name = document.getElementById('staff-name').value.trim();
              const role = document.getElementById('staff-role').value;
              const photo_path = document.getElementById('staff-photo-path').value || null;

              if (!name) {
                showToast('Staff name is required', 'error');
                return;
              }

              const result = await window.api.staff.update(data.staff.id, {
                name,
                commission_rate: data.staff.commission_rate ?? 0,
                role,
                photo_path
              });
              if (result.success) {
                closeModal();
                showToast('Staff updated', 'success');
                await refreshStaff();
                renderAdminSection('staff');
              } else {
                showToast(result.error || 'Failed to update staff', 'error');
              }
            });

            initStaffPhotoPicker(data.staff.photo_path || '');
          }
        };

      case 'editCustomer':
        return {
          title: 'Edit Customer',
          body: `
            <div class="form-group">
              <label class="form-label">Name *</label>
              <input type="text" class="form-input" id="cust-name" value="${data.customer.name}">
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="tel" class="form-input" id="cust-phone" value="${data.customer.phone || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" id="cust-email" value="${data.customer.email || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <input type="text" class="form-input" id="cust-notes" value="${data.customer.notes || ''}">
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="cancel-edit-cust">Cancel</button>
              <button class="btn btn-primary" id="save-edit-cust">Save Changes</button>
            </div>
          `,
          onMount: () => {
            document.getElementById('cancel-edit-cust').addEventListener('click', closeModal);

            document.getElementById('save-edit-cust').addEventListener('click', async () => {
              const name = document.getElementById('cust-name').value.trim();
              const phone = document.getElementById('cust-phone').value.trim();
              const email = document.getElementById('cust-email').value.trim();
              const notes = document.getElementById('cust-notes').value.trim();

              if (!name) {
                showToast('Customer name is required', 'error');
                return;
              }

              const result = await window.api.customers.update(data.customer.id, { name, phone, email, notes });
              if (result.success) {
                closeModal();
                showToast('Customer updated', 'success');
                renderAdminSection('customers');
              } else {
                showToast(result.error || 'Failed to update customer', 'error');
              }
            });
          }
        };

      case 'addCustomerAdmin':
        return {
          title: 'Add Customer',
          body: `
            <div class="form-group">
              <label class="form-label">Name *</label>
              <input type="text" class="form-input" id="cust-name" placeholder="Customer name">
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="tel" class="form-input" id="cust-phone" placeholder="Phone number">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" id="cust-email" placeholder="Email address">
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <input type="text" class="form-input" id="cust-notes" placeholder="Notes">
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" id="cancel-add-cust">Cancel</button>
              <button class="btn btn-primary" id="save-add-cust">Add Customer</button>
            </div>
          `,
          onMount: () => {
            document.getElementById('cancel-add-cust').addEventListener('click', closeModal);

            document.getElementById('save-add-cust').addEventListener('click', async () => {
              const name = document.getElementById('cust-name').value.trim();
              const phone = document.getElementById('cust-phone').value.trim();
              const email = document.getElementById('cust-email').value.trim();
              const notes = document.getElementById('cust-notes').value.trim();

              if (!name) {
                showToast('Customer name is required', 'error');
                return;
              }

              const result = await window.api.customers.create({ name, phone, email, notes });
              if (result.success) {
                closeModal();
                showToast('Customer added', 'success');
                renderAdminSection('customers');
              } else {
                showToast(result.error || 'Failed to add customer', 'error');
              }
            });

            document.getElementById('cust-name').focus();
          }
        };

      case 'addReservation':
      case 'editReservation':
        const isEdit = type === 'editReservation';
        const reservation = isEdit ? data : { date: data.date || getLocalDateString(), start_time: '09:00', customer_id: null, service_id: null, staff_id: null, status: 'scheduled' };
        
        return {
          title: isEdit ? 'Edit Reservation' : 'Add Reservation',
          body: `
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input type="date" class="form-input" id="reservation-date" value="${reservation.date || reservation.start_time?.split(' ')[0] || getLocalDateString()}">
            </div>
            <div class="form-group">
              <label class="form-label">Time *</label>
              <input type="time" class="form-input" id="reservation-time" value="${reservation.start_time?.split(' ')[1]?.substring(0, 5) || '09:00'}">
            </div>
            <div class="form-group">
              <label class="form-label">Customer</label>
              <select class="form-input" id="reservation-customer">
                <option value="">Select Customer (or create new below)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Or Add New Customer</label>
              <input type="text" class="form-input" id="reservation-new-customer-name" placeholder="New customer name">
              <input type="tel" class="form-input mt-sm" id="reservation-new-customer-phone" placeholder="Mobile number">
            </div>
            <div class="form-group">
              <label class="form-label">Service</label>
              <select class="form-input" id="reservation-service">
                <option value="">Select Service</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Staff</label>
              <select class="form-input" id="reservation-staff">
                <option value="">Select Staff</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-input" id="reservation-status">
                <option value="scheduled" ${reservation.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                <option value="confirmed" ${reservation.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                <option value="completed" ${reservation.status === 'completed' ? 'selected' : ''}>Completed</option>
                <option value="cancelled" ${reservation.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline modal-close">Cancel</button>
              <button class="btn btn-primary" id="save-reservation-btn">${isEdit ? 'Update' : 'Create'} Reservation</button>
            </div>
          `,
          onMount: async () => {
            // Load customers
            const customersResult = await window.api.customers.getAll();
            const customers = customersResult.success ? customersResult.data : [];
            const customerSelect = document.getElementById('reservation-customer');
            customerSelect.innerHTML = '<option value="">Select Customer (or create new below)</option>' + 
              customers.map(c => `<option value="${c.id}" ${reservation.customer_id === c.id ? 'selected' : ''}>${c.name} - ${c.phone || 'No phone'}</option>`).join('');

            // Load services
            const servicesResult = await window.api.services.getAll(true);
            const services = servicesResult.success ? servicesResult.data : [];
            const serviceSelect = document.getElementById('reservation-service');
            serviceSelect.innerHTML = '<option value="">Select Service</option>' + 
              services.map(s => `<option value="${s.id}" ${reservation.service_id === s.id ? 'selected' : ''}>${s.name} - ${formatCurrency(s.price)}</option>`).join('');

            // Load staff
            const staffResult = await window.api.staff.getAll(true);
            const staffList = staffResult.success ? staffResult.data : [];
            const staffSelect = document.getElementById('reservation-staff');
            staffSelect.innerHTML = '<option value="">Select Staff</option>' + 
              staffList.map(s => `<option value="${s.id}" ${reservation.staff_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

            document.getElementById('save-reservation-btn')?.addEventListener('click', async () => {
              const date = document.getElementById('reservation-date').value;
              const time = document.getElementById('reservation-time').value;
              const customerIdSelect = document.getElementById('reservation-customer').value;
              const newCustomerName = document.getElementById('reservation-new-customer-name').value.trim();
              const newCustomerPhone = document.getElementById('reservation-new-customer-phone').value.trim();
              const serviceId = document.getElementById('reservation-service').value;
              const staffId = document.getElementById('reservation-staff').value;
              const status = document.getElementById('reservation-status').value;

              if (!date || !time) {
                showToast('Please select date and time', 'error');
                return;
              }

              let customerId = customerIdSelect;

              // Create new customer if provided
              if (newCustomerName && newCustomerPhone) {
                const newCustomerResult = await window.api.customers.create({
                  name: newCustomerName,
                  phone: newCustomerPhone,
                  email: '',
                  credit: 0
                });
                if (newCustomerResult.success) {
                  customerId = newCustomerResult.data.id;
                  showToast('New customer created', 'success');
                } else {
                  showToast('Failed to create customer', 'error');
                  return;
                }
              }

              const reservationData = {
                customer_id: customerId || null,
                service_id: serviceId || null,
                staff_id: staffId || null,
                start_time: `${date} ${time}:00`,
                status: status
              };

              // TODO: Implement create/update reservation API
              showToast('Reservation management coming soon', 'info');
              console.log('Reservation data:', reservationData);
              closeModal();
              renderAdminReservations();
            });
          }
        };

      default:
        return { title: 'Modal', body: '<p>Unknown modal type</p>' };
    }
  }

  // ============================================
  // ADMIN PORTAL
  // ============================================

  async function renderAdminSection(section) {
    stopReportsTimer();
    switch (section) {
      case 'services':
        await renderAdminServices();
        break;
      case 'categories':
        await renderAdminCategories();
        break;
      case 'customers':
        await renderAdminCustomers();
        break;
      case 'staff':
        await renderAdminStaff();
        break;
      case 'reports':
        await renderAdminReports();
        break;
      case 'reservations':
        await renderAdminReservations();
        break;
      case 'settings':
        await renderAdminSettings();
        break;
    }
  }

  async function renderAdminServices() {
    const result = await window.api.services.getAll(false);
    const services = result.success ? result.data : [];

    DOM.adminContent.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <h3 class="admin-card-title">Services (${services.length})</h3>
          <button class="btn btn-primary" id="add-service-btn">+ Add Service</button>
        </div>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th>Home</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${services.length === 0 ? `
              <tr><td colspan="6" class="text-center text-muted">No services found</td></tr>
            ` : services.map(s => {
              const isHome = Number(s.show_on_home) === 1;
              return `
              <tr>
                <td>${s.name}</td>
                <td>${s.category}</td>
                <td>${formatCurrency(s.price)}</td>
                <td>${s.active ? '<span class="text-success">Active</span>' : '<span class="text-muted">Inactive</span>'}</td>
                <td>
                  <button class="btn btn-outline" data-toggle-home="${s.id}" data-home="${isHome ? 1 : 0}">
                    ${isHome ? 'On' : 'Off'}
                  </button>
                </td>
                <td class="admin-table-actions">
                  <button class="btn btn-outline" data-edit-service="${s.id}">Edit</button>
                  <button class="btn ${s.active ? 'btn-danger' : 'btn-success'}" data-toggle-service="${s.id}" data-active="${s.active}">${s.active ? 'Disable' : 'Enable'}</button>
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('add-service-btn')?.addEventListener('click', () => {
      openModal('addService');
    });

    document.querySelectorAll('[data-edit-service]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.editService);
        const service = services.find(s => s.id === id);
        if (service) {
          openModal('editService', { service });
        }
      });
    });

    document.querySelectorAll('[data-toggle-service]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.toggleService);
        const isActive = btn.dataset.active === '1';
        await window.api.services.update(id, { active: isActive ? 0 : 1 });
        await refreshServices();
        renderAdminServices();
        showToast(`Service ${isActive ? 'disabled' : 'enabled'}`, 'success');
      });
    });

    document.querySelectorAll('[data-toggle-home]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.toggleHome);
        const isHome = Number(btn.dataset.home) === 1;
        const nextValue = isHome ? 0 : 1;
        const result = await window.api.services.update(id, { show_on_home: nextValue });
        if (!result.success) {
          showToast(result.error || 'Failed to update home display', 'error');
          return;
        }

        const updatedValue = Number(result.data?.show_on_home ?? nextValue);
        btn.dataset.home = updatedValue;
        btn.textContent = updatedValue === 1 ? 'On' : 'Off';

        await refreshServices();
        renderAdminServices();
        showToast(`Home display ${updatedValue === 1 ? 'enabled' : 'disabled'}`, 'success');
      });
    });
  }

  async function renderAdminCategories() {
    const result = await window.api.categories.getAll(false);
    const categories = result.success ? result.data : [];

    DOM.adminContent.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <h3 class="admin-card-title">Categories (${categories.length})</h3>
          <button class="btn btn-primary" id="add-category-btn">+ Add Category</button>
        </div>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Display Order</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${categories.length === 0 ? `
              <tr><td colspan="4" class="text-center text-muted">No categories found</td></tr>
            ` : categories.map(c => `
              <tr>
                <td>${c.name}</td>
                <td>${c.display_order}</td>
                <td>${c.active ? '<span class="text-success">Active</span>' : '<span class="text-muted">Inactive</span>'}</td>
                <td class="admin-table-actions">
                  <button class="btn btn-danger" data-delete-category="${c.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('add-category-btn')?.addEventListener('click', () => {
      openModal('addCategory');
    });

    document.querySelectorAll('[data-delete-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.deleteCategory);
        const category = categories.find(c => c.id === id);
        if (!category) {
          return;
        }
        if (category.name.toUpperCase() === 'HOME') {
          showToast('Home category cannot be deleted', 'error');
          return;
        }

        openModal('confirm', {
          title: 'Delete Category',
          message: `Delete ${category.name} and disable all its services?`,
          onConfirm: async () => {
            const result = await window.api.categories.delete(id);
            if (result.success) {
              closeModal();
              await refreshServices();
              await refreshCategories();
              renderAdminCategories();
              showToast('Category deleted', 'success');
            } else {
              showToast(result.error || 'Failed to delete category', 'error');
            }
          }
        });
      });
    });
  }

  async function renderAdminCustomers() {
    const result = await window.api.customers.getAll();
    const customers = result.success ? result.data : [];

    DOM.adminContent.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <h3 class="admin-card-title">Customers (${customers.length})</h3>
          <button class="btn btn-primary" id="add-customer-admin-btn">+ Add Customer</button>
        </div>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Visits</th>
              <th>Loyalty Points</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${customers.length === 0 ? `
              <tr><td colspan="6" class="text-center text-muted">No customers found</td></tr>
            ` : customers.map(c => `
              <tr>
                <td>${c.name}</td>
                <td>${c.phone || '-'}</td>
                <td>${c.email || '-'}</td>
                <td>${c.visits || 0}</td>
                <td>${c.loyalty_points || 0}</td>
                <td class="admin-table-actions">
                  <button class="btn btn-outline" data-edit-customer="${c.id}">Edit</button>
                  <button class="btn btn-danger" data-delete-customer="${c.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('add-customer-admin-btn')?.addEventListener('click', () => {
      openModal('addCustomerAdmin');
    });

    document.querySelectorAll('[data-edit-customer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.editCustomer);
        const customer = customers.find(c => c.id === id);
        if (customer) {
          openModal('editCustomer', { customer });
        }
      });
    });

    document.querySelectorAll('[data-delete-customer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.deleteCustomer);
        const customer = customers.find(c => c.id === id);
        if (!customer) {
          return;
        }

        openModal('confirm', {
          title: 'Delete Customer',
          message: `Remove ${customer.name}? This keeps sales history intact.`,
          onConfirm: async () => {
            const result = await window.api.customers.delete(id);
            if (result.success) {
              closeModal();
              showToast('Customer removed', 'success');
              renderAdminCustomers();
            } else {
              showToast(result.error || 'Failed to remove customer', 'error');
            }
          }
        });
      });
    });
  }

  async function renderAdminStaff() {
    const result = await window.api.staff.getAll(false);
    const staff = result.success ? result.data : [];

    DOM.adminContent.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <h3 class="admin-card-title">Staff (${staff.length})</h3>
          <button class="btn btn-primary" id="add-staff-btn">+ Add Staff</button>
        </div>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${staff.length === 0 ? `
              <tr><td colspan="4" class="text-center text-muted">No staff found</td></tr>
            ` : staff.map(s => `
              <tr>
                <td>${s.name}</td>
                <td><span class="${s.role === 'admin' ? 'text-success' : ''}">${s.role.toUpperCase()}</span></td>
                <td>${s.active ? '<span class="text-success">Active</span>' : '<span class="text-muted">Inactive</span>'}</td>
                <td class="admin-table-actions">
                  <button class="btn btn-outline" data-edit-staff="${s.id}">Edit</button>
                  <button class="btn ${s.active ? 'btn-danger' : 'btn-success'}" data-toggle-staff="${s.id}" data-active="${s.active}">${s.active ? 'Disable' : 'Enable'}</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('add-staff-btn')?.addEventListener('click', () => {
      openModal('addStaff');
    });

    document.querySelectorAll('[data-edit-staff]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.editStaff);
        const staffMember = staff.find(s => s.id === id);
        if (staffMember) {
          openModal('editStaff', { staff: staffMember });
        }
      });
    });

    document.querySelectorAll('[data-toggle-staff]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.toggleStaff);
        const isActive = btn.dataset.active === '1';
        await window.api.staff.update(id, { active: isActive ? 0 : 1 });
        await refreshStaff();
        renderAdminStaff();
        showToast(`Staff ${isActive ? 'disabled' : 'enabled'}`, 'success');
      });
    });
  }

  async function renderAdminReports() {
    const date = reportsSelectedDate;
    const isToday = date === getLocalDateString();
    const safeInvoke = async (fn, fallback) => {
      try {
        if (!fn) {
          return { success: false, data: fallback };
        }
        return await fn();
      } catch (error) {
        return { success: false, error: error?.message || 'Request failed', data: fallback };
      }
    };

    const [result, jobsResult, categoriesResult, staffResult, reservationsResult] = await Promise.all([
      safeInvoke(() => window.api.reports?.daily?.(date), {}),
      safeInvoke(() => window.api.reports?.dailyJobs?.(date), []),
      safeInvoke(() => window.api.categories?.getAll?.(false), []),
      safeInvoke(() => window.api.reports?.staffDaily?.(date, isToday), []),
      safeInvoke(() => window.api.reports?.reservationsByDate?.(date), [])
    ]);
    const data = result.success ? result.data : {};
    const jobs = jobsResult.success ? jobsResult.data : [];
    const categories = categoriesResult.success ? categoriesResult.data : [];
    const staffReports = staffResult.success ? staffResult.data : [];
    const reservations = reservationsResult.success ? reservationsResult.data : [];

    const categoryPalette = ['#085578', '#538085', '#faf1e2', '#e3baaa', '#e47e8c', '#ffaa6a'];
    const isTodaySelected = reportsSelectedDate === getLocalDateString();
    const categoryButtons = ['All', ...categories.map(c => c.name)].map((name, index) => {
      const color = index === 0 ? '#b8cdab' : categoryPalette[(index - 1) % categoryPalette.length];
      const textColor = getTextColorForBackground(color);
      return `<button class="reports-category-btn ${index === 0 ? 'active' : ''}" data-category="${name}" style="background: ${color}; color: ${textColor};">${name}</button>`;
    }).join('');

    const staffCards = staffReports.map(staff => {
      const payments = staff.payments || [];
      const paymentsMarkup = payments.length === 0
        ? `<div class="staff-report-empty">No payments recorded</div>`
        : payments.map(p => `
          <div class="staff-report-row">
            <span>${(p.method || '').toUpperCase()}</span>
            <span>${formatCurrency(p.total || 0)}</span>
          </div>
        `).join('');

      return `
        <details class="staff-report-card">
          <summary>
            <div class="staff-report-title">
              <span>${staff.staff_name}</span>
              <span class="staff-report-meta">${staff.jobs_count} jobs</span>
            </div>
            <div class="staff-report-total">${formatCurrency(staff.total_sales || 0)}</div>
          </summary>
          <div class="staff-report-body">
            <div class="staff-report-row">
              <span>Clock in</span>
              <span>${staff.first_clock_in ? formatTime(staff.first_clock_in) : '--'}</span>
            </div>
            <div class="staff-report-row">
              <span>Clock out</span>
              <span>${staff.last_clock_out ? formatTime(staff.last_clock_out) : '--'}</span>
            </div>
            <div class="staff-report-row">
              <span>Total time</span>
              <span>${formatMinutesToDuration(staff.total_minutes || 0)}</span>
            </div>
            <div class="staff-report-section">Payment received</div>
            ${paymentsMarkup}
          </div>
        </details>
      `;
    }).join('');

    const reservationsMarkup = reservations.length === 0
      ? `<div class="staff-report-empty">No reservations for this date</div>`
      : reservations.map(res => `
        <div class="reservation-item">
          <div class="reservation-time">${formatTime(res.start_time)}</div>
          <div class="reservation-main">
            <div class="reservation-name">${res.customer_name || 'Walk-in'}</div>
            <div class="reservation-meta">${res.service_name || 'Reservation'} • ${res.staff_name || 'Unassigned'}</div>
          </div>
          <div class="reservation-status">${(res.status || 'scheduled').toUpperCase()}</div>
        </div>
      `).join('');

    DOM.adminContent.innerHTML = `
      <div class="reports-layout">
        <section class="reports-left">
          <div class="reports-timer-grid">
            <div class="reports-timer-card">
              <div class="reports-timer-label">Current Day Duration</div>
              <div class="reports-timer-value" id="reports-day-duration">${isToday ? '00:00:00' : '--:--:--'}</div>
            </div>
            <div class="reports-timer-card">
              <div class="reports-timer-label">Jobs Completed</div>
              <div class="reports-job-count" id="reports-job-count">${jobs.length}</div>
            </div>
          </div>

          <div class="reports-category-bar" id="reports-category-bar">
            ${categoryButtons}
          </div>

          <div class="admin-card">
            <h3 class="admin-card-title">Completed Jobs</h3>
            <div class="reports-job-list" id="reports-job-list"></div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${data.transaction_count || 0}</div>
              <div class="stat-label">Transactions</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${formatCurrency(data.total_sales || 0)}</div>
              <div class="stat-label">Total Sales</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${formatCurrency(data.average_sale || 0)}</div>
              <div class="stat-label">Average Sale</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${formatCurrency(data.total_discounts || 0)}</div>
              <div class="stat-label">Total Discounts</div>
            </div>
          </div>

          <div class="admin-card">
            <h3 class="admin-card-title">Top Services</h3>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Quantity</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${(data.topServices || []).length === 0 ? `
                  <tr><td colspan="3" class="text-center text-muted">No data for this date</td></tr>
                ` : (data.topServices || []).map(s => `
                  <tr>
                    <td>${s.service_name}</td>
                    <td>${s.quantity}</td>
                    <td>${formatCurrency(s.revenue)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="admin-card">
            <h3 class="admin-card-title">Sales by Payment Method</h3>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Count</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${(data.byPaymentMethod || []).length === 0 ? `
                  <tr><td colspan="3" class="text-center text-muted">No data for this date</td></tr>
                ` : (data.byPaymentMethod || []).map(p => `
                  <tr>
                    <td>${p.payment_method.toUpperCase()}</td>
                    <td>${p.count}</td>
                    <td>${formatCurrency(p.total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <div class="admin-card reports-staff-card">
          <h3 class="admin-card-title">Staff Reports</h3>
          <div class="staff-report-grid">
            ${staffCards || '<div class="staff-report-empty">No staff data</div>'}
          </div>
        </div>

        <div class="reports-actions">
          <button class="btn btn-outline" id="reports-export-csv">Save as CSV</button>
          <button class="btn btn-outline" id="reports-print">Print</button>
        </div>
        </section>
      </div>
    `;

    const jobListEl = document.getElementById('reports-job-list');
    const jobCountEl = document.getElementById('reports-job-count');
    const renderJobs = (categoryFilter) => {
      const filtered = categoryFilter === 'All'
        ? jobs
        : jobs.filter(job => (job.category || 'Uncategorized') === categoryFilter);

      if (jobCountEl) {
        jobCountEl.textContent = filtered.length;
      }

      if (!jobListEl) {
        return;
      }

      if (filtered.length === 0) {
        jobListEl.innerHTML = `
          <div class="empty-bill">
            <p>No jobs completed yet</p>
          </div>
        `;
        return;
      }

      jobListEl.innerHTML = filtered.map(job => `
        <div class="reports-job-item">
          <div class="reports-job-time">${formatTime(job.created_at)}</div>
          <div>
            <div class="reports-job-name">${job.service_name}</div>
            <div class="reports-job-meta">${job.staff_name || 'No staff'} • ${job.quantity}x</div>
          </div>
          <div class="reports-job-category">${job.category || 'Uncategorized'}</div>
        </div>
      `).join('');
    };

    renderJobs('All');

    document.querySelectorAll('.reports-category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.reports-category-btn').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        renderJobs(btn.dataset.category);
      });
    });

    document.getElementById('reports-today')?.addEventListener('click', () => {
      reportsSelectedDate = getLocalDateString();
      renderAdminReports();
    });

    document.querySelectorAll('.reports-date-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const range = btn.dataset.range;
        if (range === 'prev') {
          reportsSelectedDate = addDays(reportsSelectedDate, -1);
        } else if (range === 'next') {
          reportsSelectedDate = addDays(reportsSelectedDate, 1);
        } else {
          reportsSelectedDate = getLocalDateString();
        }
        renderAdminReports();
      });
    });
    document.getElementById('reports-date-input')?.addEventListener('change', (e) => {
      if (e.target.value) {
        reportsSelectedDate = e.target.value;
        renderAdminReports();
      }
    });


    document.getElementById('reports-export-csv')?.addEventListener('click', async () => {
      const result = await window.api.reports.exportStaffCsv(reportsSelectedDate);
      if (result.success) {
        showToast('CSV saved', 'success');
      } else {
        showToast(result.error || 'CSV export failed', 'error');
      }
    });

    document.getElementById('reports-print')?.addEventListener('click', () => {
      showToast('Print is not configured yet', 'info');
    });

    if (isToday) {
      startReportsTimer();
    } else {
      stopReportsTimer();
    }
  }

  async function renderAdminReservations() {
    const date = reportsSelectedDate;
    const isTodaySelected = reportsSelectedDate === getLocalDateString();
    
    const reservationsResult = await window.api.reports.reservationsByDate(date);
    const reservations = reservationsResult.success ? reservationsResult.data : [];

    const reservationsMarkup = reservations.length === 0
      ? `<div class="staff-report-empty">No reservations for this date</div>`
      : reservations.map(res => `
        <div class="reservation-item">
          <div class="reservation-time">${formatTime(res.start_time)}</div>
          <div class="reservation-main">
            <div class="reservation-name">${res.customer_name || 'Walk-in'}</div>
            <div class="reservation-meta">${res.service_name || 'Reservation'} • ${res.staff_name || 'Unassigned'}</div>
          </div>
          <div class="reservation-status">${(res.status || 'scheduled').toUpperCase()}</div>
          <div class="reservation-actions">
            <button class="btn btn-outline btn-sm" data-edit-reservation="${res.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-delete-reservation="${res.id}">Delete</button>
          </div>
        </div>
      `).join('');

    DOM.adminContent.innerHTML = `
      <div class="admin-card reports-calendar-card">
        <h3 class="admin-card-title">Select Date</h3>
        <div class="reports-date-pills">
          <button class="reports-date-pill" data-range="prev">Prev Day</button>
          <button class="reports-date-pill ${isTodaySelected ? 'active' : ''}" data-range="today" id="today-date-btn">Today</button>
          <button class="reports-date-pill" data-range="next">Next Day</button>
        </div>
        <div class="reports-date-display">
          <button class="btn btn-outline" id="select-date-btn">${formatDateDisplay(date)}</button>
        </div>
        <input type="date" id="hidden-date-input" style="display: none;" value="${date}">
      </div>

      <div class="admin-card reports-reservations-card">
        <div class="admin-card-header">
          <h3 class="admin-card-title">Reservations for ${date}</h3>
          <button class="btn btn-primary" id="add-reservation-btn">+ Add Reservation</button>
        </div>
        <div class="reservation-list">
          ${reservationsMarkup}
        </div>
      </div>
    `;

    document.querySelectorAll('.reports-date-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const range = btn.dataset.range;
        if (range === 'prev') {
          const d = new Date(reportsSelectedDate);
          d.setDate(d.getDate() - 1);
          reportsSelectedDate = getLocalDateString(d);
        } else if (range === 'next') {
          const d = new Date(reportsSelectedDate);
          d.setDate(d.getDate() + 1);
          reportsSelectedDate = getLocalDateString(d);
        } else {
          reportsSelectedDate = getLocalDateString();
        }
        renderAdminReservations();
      });
    });

    // Date selection button - opens hidden date input
    document.getElementById('select-date-btn')?.addEventListener('click', () => {
      const hiddenInput = document.getElementById('hidden-date-input');
      if (hiddenInput) {
        hiddenInput.showPicker();
      }
    });

    document.getElementById('hidden-date-input')?.addEventListener('change', (e) => {
      if (e.target.value) {
        reportsSelectedDate = e.target.value;
        renderAdminReservations();
      }
    });

    document.getElementById('add-reservation-btn')?.addEventListener('click', () => {
      openModal('addReservation', { date: reportsSelectedDate });
    });

    document.querySelectorAll('[data-edit-reservation]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.editReservation);
        const reservation = reservations.find(r => r.id === id);
        if (reservation) {
          openModal('editReservation', reservation);
        }
      });
    });

    document.querySelectorAll('[data-delete-reservation]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.deleteReservation);
        if (confirm('Are you sure you want to delete this reservation?')) {
          // TODO: Implement delete reservation API call
          showToast('Delete reservation functionality coming soon', 'info');
        }
      });
    });
  }

  async function renderAdminSettings() {
    const result = await window.api.settings.getAll();
    const settings = result.success ? result.data : {};

    DOM.adminContent.innerHTML = `
      <div class="admin-card">
        <h3 class="admin-card-title">Business Settings</h3>
        <div class="form-group">
          <label class="form-label">Business Name</label>
          <input type="text" class="form-input" id="setting-business-name" value="${settings.business_name || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Currency Symbol</label>
          <input type="text" class="form-input" id="setting-currency" value="${settings.currency_symbol || '$'}" maxlength="3">
        </div>
        <button class="btn btn-primary mt-md" id="save-settings-btn">Save Settings</button>
      </div>

      <div class="admin-card">
        <h3 class="admin-card-title">Security</h3>
        <div class="form-group">
          <label class="form-label">New Admin PIN (5 digits)</label>
          <input type="password" class="form-input" id="setting-admin-pin" placeholder="Enter new 5-digit PIN" maxlength="5">
        </div>
        <button class="btn btn-primary mt-md" id="save-pin-btn">Update PIN</button>
      </div>

      <div class="admin-card">
        <h3 class="admin-card-title">Database</h3>
        <p class="text-muted mb-md">Backup and restore your database</p>
        <div class="flex gap-md">
          <button class="btn btn-outline" id="backup-db-btn">Backup Database</button>
          <button class="btn btn-outline" id="restore-db-btn">Restore Database</button>
        </div>
      </div>

      <div class="admin-card">
        <h3 class="admin-card-title">Exit Application</h3>
        <p class="text-muted mb-md">Close the POS application</p>
        <button class="btn btn-danger" id="exit-app-btn">Exit Application</button>
      </div>
    `;

    document.getElementById('save-settings-btn')?.addEventListener('click', async () => {
      const businessName = document.getElementById('setting-business-name').value;
      const currency = document.getElementById('setting-currency').value;

      await window.api.settings.set('business_name', businessName);
      await window.api.settings.set('currency_symbol', currency);
      currencySymbol = currency;

      showToast('Settings saved', 'success');
    });

    document.getElementById('save-pin-btn')?.addEventListener('click', async () => {
      const newPin = document.getElementById('setting-admin-pin').value;
      if (newPin.length !== 5 || !/^\d+$/.test(newPin)) {
        showToast('PIN must be exactly 5 digits', 'error');
        return;
      }

      await window.api.settings.set('admin_pin', newPin);
      document.getElementById('setting-admin-pin').value = '';
      showToast('PIN updated', 'success');
    });

    document.getElementById('backup-db-btn')?.addEventListener('click', async () => {
      const result = await window.api.database.backup();
      if (result.success) {
        showToast('Backup saved successfully', 'success');
      } else {
        showToast(result.error || 'Backup failed', 'error');
      }
    });

    document.getElementById('restore-db-btn')?.addEventListener('click', async () => {
      openModal('confirm', {
        title: 'Restore Database',
        message: 'This will replace all current data with the backup. Are you sure?',
        onConfirm: async () => {
          closeModal();
          const result = await window.api.database.restore();
          if (result.success) {
            showToast('Database restored. Reloading...', 'success');
            setTimeout(() => location.reload(), 1500);
          } else {
            showToast(result.error || 'Restore failed', 'error');
          }
        }
      });
    });

    document.getElementById('exit-app-btn')?.addEventListener('click', async () => {
      openModal('confirm', {
        title: 'Exit Application',
        message: 'Are you sure you want to exit the POS?',
        onConfirm: async () => {
          const settings = await window.api.settings.getAll();
          const pin = settings.success ? settings.data.admin_pin : '12345';
          await window.api.app.exitKiosk(pin);
        }
      });
    });
  }

  // ============================================
  // DATA REFRESH HELPERS
  // ============================================

  async function refreshServices() {
    const result = await window.api.services.getAll();
    if (result.success) {
      store.setState({ services: result.data });
      renderServices();
    }
  }

  async function refreshCategories() {
    const result = await window.api.categories.getAll();
    if (result.success) {
      store.setState({ categories: result.data });
      renderCategories();
    }
  }

  async function refreshStaff() {
    const result = await window.api.staff.getAll();
    if (result.success) {
      store.setState({ staff: result.data });
      renderStaff();
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  // Reports timer keeps a live day-duration display while in admin reports.
  function startReportsTimer() {
    stopReportsTimer();
    const timerEl = document.getElementById('reports-day-duration');
    if (!timerEl) {
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const diff = now.getTime() - startOfDay.getTime();
      timerEl.textContent = formatDuration(diff);
    };

    updateTimer();
    reportsTimerInterval = setInterval(updateTimer, 1000);
  }

  function stopReportsTimer() {
    if (reportsTimerInterval) {
      clearInterval(reportsTimerInterval);
      reportsTimerInterval = null;
    }
  }

  // Customer dropdown search helpers for fast lookup.
  async function performCustomerSearch(forceOpen) {
    const query = DOM.customerLookupInput.value.trim();

    if (!query) {
      customerSearchState.query = '';
      customerSearchState.results = [];
      customerSearchState.activeIndex = -1;
      closeCustomerDropdown();
      return;
    }

    if (!forceOpen && query === customerSearchState.query) {
      return;
    }

    customerSearchState.query = query;
    const result = await window.api.customers.search(query);
    customerSearchState.results = result.success ? result.data : [];
    customerSearchState.activeIndex = -1;
    renderCustomerDropdown();
  }

  function renderCustomerDropdown() {
    if (!DOM.customerDropdown || !DOM.customerDropdownList) {
      return;
    }

    const results = customerSearchState.results;
    const query = customerSearchState.query;

    if (!query) {
      closeCustomerDropdown();
      return;
    }

    DOM.customerDropdown.classList.add('active');
    DOM.customerDropdownList.innerHTML = results.map((customer, index) => `
      <button type="button" class="customer-dropdown-item ${index === customerSearchState.activeIndex ? 'active' : ''}" data-customer-id="${customer.id}">
        <strong>${customer.name}</strong>
        <span>${customer.phone || 'No phone'}</span>
      </button>
    `).join('');

    DOM.customerDropdownEmpty.classList.toggle('visible', results.length === 0);
    DOM.customerDropdownAdd.classList.toggle('visible', results.length === 0);

    DOM.customerDropdownList.querySelectorAll('.customer-dropdown-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.customerId);
        selectCustomerFromDropdown(id);
      });
      item.addEventListener('mouseenter', () => {
        customerSearchState.activeIndex = index;
        updateCustomerDropdownActive();
      });
    });
  }

  function updateCustomerDropdownActive() {
    const items = DOM.customerDropdownList?.querySelectorAll('.customer-dropdown-item');
    if (!items || items.length === 0) {
      return;
    }

    items.forEach((item, index) => {
      item.classList.toggle('active', index === customerSearchState.activeIndex);
    });

    if (customerSearchState.activeIndex >= 0) {
      items[customerSearchState.activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function moveCustomerDropdown(delta) {
    const results = customerSearchState.results;
    if (!results.length) {
      return;
    }

    let nextIndex = customerSearchState.activeIndex + delta;
    if (nextIndex < 0) {
      nextIndex = results.length - 1;
    }
    if (nextIndex >= results.length) {
      nextIndex = 0;
    }

    customerSearchState.activeIndex = nextIndex;
    updateCustomerDropdownActive();
  }

  function handleCustomerDropdownKeydown(e) {
    const isOpen = DOM.customerDropdown?.classList.contains('active');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        performCustomerSearch(true);
        return;
      }
      moveCustomerDropdown(1);
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        performCustomerSearch(true);
        return;
      }
      moveCustomerDropdown(-1);
    }

    if (e.key === 'Enter') {
      if (!isOpen) {
        performCustomerSearch(true);
        return;
      }

      if (customerSearchState.activeIndex >= 0) {
        e.preventDefault();
        const customer = customerSearchState.results[customerSearchState.activeIndex];
        if (customer) {
          selectCustomerFromDropdown(customer.id);
        }
      }
    }

    if (e.key === 'Escape') {
      closeCustomerDropdown();
    }
  }

  async function selectCustomerFromDropdown(customerId) {
    const customerResult = await window.api.customers.get(customerId);
    if (customerResult.success) {
      store.setCustomer(customerResult.data);
      DOM.customerLookupInput.value = customerResult.data.name;
      renderCustomerInfo();
      closeCustomerDropdown();
    }
  }

  function closeCustomerDropdown() {
    if (DOM.customerDropdown) {
      DOM.customerDropdown.classList.remove('active');
    }
    DOM.customerDropdownEmpty?.classList.remove('visible');
    DOM.customerDropdownAdd?.classList.remove('visible');
    if (DOM.customerDropdownList) {
      DOM.customerDropdownList.innerHTML = '';
    }
    customerSearchState.results = [];
    customerSearchState.activeIndex = -1;
  }

  function getLocalDateString(date = new Date()) {
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().split('T')[0];
  }

  function formatDateDisplay(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  function addDays(dateString, delta) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + delta);
    return getLocalDateString(date);
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  function formatMinutesToDuration(minutes) {
    const totalMinutes = Math.max(0, Math.round(minutes || 0));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${pad2(hours)}:${pad2(mins)}`;
  }

  function generateCategoryColors(count) {
    const fixedColors = ['#085578', '#538085', '#faf1e2', '#e3baaa', '#e47e8c', '#ffaa6a'];
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(fixedColors[i % fixedColors.length]);
    }
    return colors;
  }

  function getTextColorForBackground(hexColor) {
    // Convert hex to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return dark text for light backgrounds, light text for dark backgrounds
    return luminance > 0.5 ? '#0a2d2e' : '#fbf2c4';
  }

  function formatTime(value) {
    const date = value instanceof Date ? value : parseSqliteDate(value);
    if (!date) {
      return '--:--';
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function parseSqliteDate(value) {
    if (!value) {
      return null;
    }
    return new Date(value.replace(' ', 'T'));
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function toFileUrl(filePath) {
    if (!filePath) return '';
    const normalized = filePath.replace(/\\/g, '/');
    return encodeURI(`file:///${normalized}`);
  }

  function initStaffPhotoPicker(initialPath) {
    const preview = document.getElementById('staff-photo-preview');
    const input = document.getElementById('staff-photo-path');
    const chooseBtn = document.getElementById('staff-photo-btn');
    const clearBtn = document.getElementById('staff-photo-clear');

    if (!preview || !input || !chooseBtn || !clearBtn) {
      return;
    }

    const setPhoto = (pathValue) => {
      input.value = pathValue || '';
      if (pathValue) {
        const photoUrl = toFileUrl(pathValue);
        preview.innerHTML = `<img class="staff-photo-img" src="${photoUrl}" alt="Staff photo">`;
        clearBtn.disabled = false;
      } else {
        preview.textContent = 'No photo';
        clearBtn.disabled = true;
      }
    };

    chooseBtn.addEventListener('click', async () => {
      const result = await window.api.staff.selectPhoto();
      if (result?.success && result.data?.path) {
        setPhoto(result.data.path);
        return;
      }
      if (result?.error && result.error !== 'Photo selection cancelled') {
        showToast(result.error || 'Failed to select photo', 'error');
      }
    });

    clearBtn.addEventListener('click', () => setPhoto(''));
    setPhoto(initialPath);
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  function goHome() {
    store.setState({ selectedCategory: 'HOME' });
    renderCategories();
    renderServices();
  }

  // ============================================
  // STARTUP
  // ============================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
