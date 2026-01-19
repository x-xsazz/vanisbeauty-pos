/**
 * Simple reactive state management for the POS
 * No external dependencies - just vanilla JS
 */

class StateManager {
  constructor() {
    this.state = {
      // View state
      currentView: 'pos', // 'pos' or 'admin'
      isAdminAuthenticated: false,

      // Services data
      services: [],
      categories: [],
      selectedCategory: 'HOME',
      serviceSearchQuery: '',

      // Staff data
      staff: [],

      // Current bill being constructed
      currentBill: {
        items: [],
        customer: null,
        subtotal: 0,
        discountAmount: 0,
        discountType: null,
        total: 0,
        notes: ''
      },

      // Selected staff for new items
      selectedStaff: null,

      // UI state
      activeModal: null,
      modalData: null,
      isLoading: false,
      error: null,

      // Settings
      settings: {
        currency_symbol: '$',
        business_name: 'VanisBeauty',
        tax_rate: '0'
      }
    };

    this.subscribers = new Map();
    this.subscriberId = 0;
  }

  // Get current state
  getState() {
    return this.state;
  }

  // Get a specific state value
  get(key) {
    return key.split('.').reduce((obj, k) => obj?.[k], this.state);
  }

  // Update state and notify subscribers
  setState(updates) {
    const prevState = { ...this.state };

    if (typeof updates === 'function') {
      const newState = updates(this.state);
      this.state = { ...this.state, ...newState };
    } else {
      this.state = { ...this.state, ...updates };
    }

    this.notifySubscribers(prevState);
  }

  // Subscribe to state changes
  subscribe(callback, keys = null) {
    const id = ++this.subscriberId;
    this.subscribers.set(id, { callback, keys });
    return () => this.subscribers.delete(id);
  }

  // Notify all subscribers
  notifySubscribers(prevState) {
    this.subscribers.forEach(({ callback, keys }) => {
      if (keys === null) {
        callback(this.state, prevState);
      } else {
        const changed = keys.some(key =>
          this.get(key) !== key.split('.').reduce((obj, k) => obj?.[k], prevState)
        );
        if (changed) {
          callback(this.state, prevState);
        }
      }
    });
  }

  // Bill management methods
  addItemToBill(service, staff = null) {
    const existingIndex = this.state.currentBill.items.findIndex(
      item => item.service_id === service.id && item.staff_id === (staff?.id || null)
    );

    let newItems;
    if (existingIndex >= 0) {
      newItems = [...this.state.currentBill.items];
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: newItems[existingIndex].quantity + 1
      };
    } else {
      const newItem = {
        id: Date.now(),
        service_id: service.id,
        service_name: service.name,
        price: service.price,
        quantity: 1,
        staff_id: staff?.id || null,
        staff_name: staff?.name || null,
        notes: ''
      };
      newItems = [...this.state.currentBill.items, newItem];
    }

    this.updateBillItems(newItems);
  }

  removeItemFromBill(itemId) {
    const newItems = this.state.currentBill.items.filter(item => item.id !== itemId);
    this.updateBillItems(newItems);
  }

  updateBillItem(itemId, updates) {
    const newItems = this.state.currentBill.items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    this.updateBillItems(newItems);
  }

  updateItemQuantity(itemId, delta) {
    const item = this.state.currentBill.items.find(i => i.id === itemId);
    if (!item) return;

    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
      this.removeItemFromBill(itemId);
    } else {
      this.updateBillItem(itemId, { quantity: newQuantity });
    }
  }

  updateBillItems(items) {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = this.state.currentBill.discountAmount;
    const total = Math.max(0, subtotal - discountAmount);

    this.setState({
      currentBill: {
        ...this.state.currentBill,
        items,
        subtotal,
        total
      }
    });
  }

  setCustomer(customer) {
    this.setState({
      currentBill: {
        ...this.state.currentBill,
        customer
      }
    });
  }

  setDiscount(amount, type = 'fixed') {
    const subtotal = this.state.currentBill.subtotal;
    let discountAmount = amount;

    if (type === 'percent') {
      discountAmount = (subtotal * amount) / 100;
    }

    this.setState({
      currentBill: {
        ...this.state.currentBill,
        discountAmount,
        discountType: type,
        total: Math.max(0, subtotal - discountAmount)
      }
    });
  }

  clearBill() {
    this.setState({
      currentBill: {
        items: [],
        customer: null,
        subtotal: 0,
        discountAmount: 0,
        discountType: null,
        total: 0,
        notes: ''
      }
    });
  }

  // Modal management
  openModal(modalName, data = null) {
    this.setState({
      activeModal: modalName,
      modalData: data
    });
  }

  closeModal() {
    this.setState({
      activeModal: null,
      modalData: null
    });
  }

  // View management
  setView(view) {
    this.setState({ currentView: view });
  }

  setAdminAuthenticated(value) {
    this.setState({ isAdminAuthenticated: value });
  }

  // Loading and error states
  setLoading(isLoading) {
    this.setState({ isLoading });
  }

  setError(error) {
    this.setState({ error });
  }

  clearError() {
    this.setState({ error: null });
  }
}

// Singleton instance
const store = new StateManager();

// Export for use in other modules
window.store = store;
