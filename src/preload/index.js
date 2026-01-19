const { contextBridge, ipcRenderer } = require('electron');

// Secure API exposed to renderer
contextBridge.exposeInMainWorld('api', {
  // Services
  services: {
    getAll: (activeOnly) => ipcRenderer.invoke('services:getAll', activeOnly),
    getByCategory: (category) => ipcRenderer.invoke('services:getByCategory', category),
    get: (id) => ipcRenderer.invoke('services:get', id),
    create: (data) => ipcRenderer.invoke('services:create', data),
    update: (id, data) => ipcRenderer.invoke('services:update', id, data),
    delete: (id) => ipcRenderer.invoke('services:delete', id)
  },

  // Categories
  categories: {
    getAll: (activeOnly) => ipcRenderer.invoke('categories:getAll', activeOnly),
    create: (data) => ipcRenderer.invoke('categories:create', data),
    delete: (id) => ipcRenderer.invoke('categories:delete', id)
  },

  // Customers
  customers: {
    getAll: () => ipcRenderer.invoke('customers:getAll'),
    search: (query) => ipcRenderer.invoke('customers:search', query),
    get: (id) => ipcRenderer.invoke('customers:get', id),
    create: (data) => ipcRenderer.invoke('customers:create', data),
    update: (id, data) => ipcRenderer.invoke('customers:update', id, data),
    delete: (id) => ipcRenderer.invoke('customers:delete', id)
  },

  // Staff
  staff: {
    getAll: (activeOnly) => ipcRenderer.invoke('staff:getAll', activeOnly),
    get: (id) => ipcRenderer.invoke('staff:get', id),
    create: (data) => ipcRenderer.invoke('staff:create', data),
    update: (id, data) => ipcRenderer.invoke('staff:update', id, data),
    selectPhoto: () => ipcRenderer.invoke('staff:selectPhoto'),
    clockStatus: (staffId, date) => ipcRenderer.invoke('staff:clockStatus', staffId, date),
    clockIn: (staffId) => ipcRenderer.invoke('staff:clockIn', staffId),
    clockOut: (logId) => ipcRenderer.invoke('staff:clockOut', logId)
  },

  // Bills
  bills: {
    create: (data) => ipcRenderer.invoke('bills:create', data),
    get: (id) => ipcRenderer.invoke('bills:get', id),
    getAll: (options) => ipcRenderer.invoke('bills:getAll', options)
  },

  // Reports
  reports: {
    daily: (date) => ipcRenderer.invoke('reports:daily', date),
    dailyJobs: (date) => ipcRenderer.invoke('reports:dailyJobs', date),
    staffDaily: (date, useNowForOpenLogs) => ipcRenderer.invoke('reports:staffDaily', date, useNowForOpenLogs),
    reservationsByDate: (date) => ipcRenderer.invoke('reports:reservationsByDate', date),
    exportStaffCsv: (date) => ipcRenderer.invoke('reports:exportStaffCsv', date)
  },

  // Settings
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },

  // Admin
  admin: {
    verifyPin: (pin) => ipcRenderer.invoke('admin:verifyPin', pin)
  },

  // Database
  database: {
    backup: () => ipcRenderer.invoke('database:backup'),
    restore: () => ipcRenderer.invoke('database:restore')
  },

  // App
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
    exitKiosk: (pin) => ipcRenderer.invoke('app:exitKiosk', pin)
  },

  // Modals
  modals: {
    openCustomerLookup: () => ipcRenderer.send('open-customer-lookup'),
    openPinKeypad: (config) => ipcRenderer.send('open-pin-keypad', config),
    onCustomerSelected: (callback) => ipcRenderer.on('customer-selected', (event, customer) => callback(customer)),
    onPinVerified: (callback) => ipcRenderer.on('pin-verified', (event, data) => callback(data)),
    onAddCustomerFromLookup: (callback) => ipcRenderer.on('open-add-customer-from-lookup', () => callback())
  }
});
