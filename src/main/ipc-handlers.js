const { app } = require('electron');
const path = require('path');
const fs = require('fs');

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function registerIpcHandlers(ipcMain, db, mainWindow, dialog) {
  // Services
  ipcMain.handle('services:getAll', (event, activeOnly = true) => {
    try {
      return { success: true, data: db.getServices(activeOnly) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('services:getByCategory', (event, category) => {
    try {
      return { success: true, data: db.getServicesByCategory(category) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('services:get', (event, id) => {
    try {
      return { success: true, data: db.getService(id) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('services:create', (event, data) => {
    try {
      return { success: true, data: db.createService(data) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('services:update', (event, id, data) => {
    try {
      return { success: true, data: db.updateService(id, data) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('services:delete', (event, id) => {
    try {
      db.deleteService(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Categories
  ipcMain.handle('categories:getAll', (event, activeOnly = true) => {
    try {
      return { success: true, data: db.getCategories(activeOnly) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('categories:create', (event, data) => {
    try {
      return { success: true, data: db.createCategory(data) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('categories:delete', (event, id) => {
    try {
      db.deleteCategory(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Customers
  ipcMain.handle('customers:getAll', () => {
    try {
      return { success: true, data: db.getCustomers() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customers:search', (event, query) => {
    try {
      return { success: true, data: db.searchCustomers(query) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customers:get', (event, id) => {
    try {
      return { success: true, data: db.getCustomer(id) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customers:create', (event, data) => {
    try {
      return { success: true, data: db.createCustomer(data) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customers:update', (event, id, data) => {
    try {
      return { success: true, data: db.updateCustomer(id, data) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customers:delete', (event, id) => {
    try {
      db.deleteCustomer(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Staff
  ipcMain.handle('staff:getAll', (event, activeOnly = true) => {
    try {
      return { success: true, data: db.getStaff(activeOnly) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('staff:get', (event, id) => {
    try {
      return { success: true, data: db.getStaffMember(id) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('staff:create', (event, data) => {
    try {
      return { success: true, data: db.createStaff(data) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('staff:update', (event, id, data) => {
    try {
      return { success: true, data: db.updateStaff(id, data) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('staff:clockStatus', (event, staffId, date) => {
    try {
      return { success: true, data: db.getStaffClockStatus(staffId, date) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('staff:clockIn', (event, staffId) => {
    try {
      return { success: true, data: db.clockInStaff(staffId) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('staff:clockOut', (event, logId) => {
    try {
      return { success: true, data: db.clockOutStaff(logId) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('staff:selectPhoto', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Staff Photo',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
        properties: ['openFile']
      });

      if (result.canceled) {
        return { success: false, error: 'Photo selection cancelled' };
      }

      const sourcePath = result.filePaths[0];
      const photosDir = path.join(app.getPath('userData'), 'staff-photos');
      if (!fs.existsSync(photosDir)) {
        fs.mkdirSync(photosDir, { recursive: true });
      }

      const ext = path.extname(sourcePath);
      const baseName = path.basename(sourcePath, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
      const destPath = path.join(photosDir, `${baseName}-${Date.now()}${ext}`);

      fs.copyFileSync(sourcePath, destPath);
      return { success: true, data: { path: destPath } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Bills
  ipcMain.handle('bills:create', (event, data) => {
    try {
      return { success: true, data: db.createBill(data) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('bills:get', (event, id) => {
    try {
      return { success: true, data: db.getBill(id) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('bills:getAll', (event, options) => {
    try {
      return { success: true, data: db.getBills(options) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Reports
  ipcMain.handle('reports:daily', (event, date) => {
    try {
      return { success: true, data: db.getDailySummary(date) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports:dailyJobs', (event, date) => {
    try {
      return { success: true, data: db.getDailyJobs(date) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports:staffDaily', (event, date, useNowForOpenLogs = false) => {
    try {
      return { success: true, data: db.getStaffDailyReport(date, useNowForOpenLogs) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports:reservationsByDate', (event, date) => {
    try {
      return { success: true, data: db.getReservationsByDate(date) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reports:exportStaffCsv', async (event, date) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Save Staff Report CSV',
        defaultPath: `staff-report-${date}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      });

      if (result.canceled) {
        return { success: false, error: 'Export cancelled' };
      }

      const staffReport = db.getStaffDailyReport(date, false);
      const reservations = db.getReservationsByDate(date);

      const staffLines = [
        'Section,Staff,Clock In,Clock Out,Total Minutes,Jobs,Total Sales,Payments'
      ];
      staffReport.forEach(row => {
        const payments = row.payments.map(p => `${p.method}:${p.total}`).join(' | ');
        staffLines.push([
          'STAFF_SUMMARY',
          csvEscape(row.staff_name),
          row.first_clock_in || '',
          row.last_clock_out || '',
          row.total_minutes || 0,
          row.jobs_count || 0,
          row.total_sales || 0,
          csvEscape(payments)
        ].join(','));
      });

      const reservationLines = [
        '',
        'Section,Start Time,End Time,Staff,Customer,Phone,Service,Status,Notes'
      ];
      reservations.forEach(res => {
        reservationLines.push([
          'RESERVATION',
          res.start_time || '',
          res.end_time || '',
          csvEscape(res.staff_name || ''),
          csvEscape(res.customer_name || ''),
          csvEscape(res.customer_phone || ''),
          csvEscape(res.service_name || ''),
          csvEscape(res.status || ''),
          csvEscape(res.notes || '')
        ].join(','));
      });

      const csv = [...staffLines, ...reservationLines].join('\n');
      fs.writeFileSync(result.filePath, csv, 'utf8');
      return { success: true, data: { path: result.filePath } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Settings
  ipcMain.handle('settings:get', (event, key) => {
    try {
      return { success: true, data: db.getSetting(key) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:set', (event, key, value) => {
    try {
      db.setSetting(key, value);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:getAll', () => {
    try {
      return { success: true, data: db.getSettings() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Admin PIN verification
  ipcMain.handle('admin:verifyPin', (event, pin) => {
    try {
      const valid = db.verifyAdminPin(pin);
      return { success: true, data: { valid } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Database backup
  ipcMain.handle('database:backup', async () => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Save Database Backup',
        defaultPath: `pos-backup-${new Date().toISOString().split('T')[0]}.db`,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
      });

      if (result.canceled) {
        return { success: false, error: 'Backup cancelled' };
      }

      await db.backup(result.filePath);
      return { success: true, data: { path: result.filePath } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Database restore
  ipcMain.handle('database:restore', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Database Backup',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['openFile']
      });

      if (result.canceled) {
        return { success: false, error: 'Restore cancelled' };
      }

      const backupPath = result.filePaths[0];
      const currentDbPath = db.dbPath;

      db.close();

      const tempBackup = currentDbPath + '.temp';
      fs.copyFileSync(currentDbPath, tempBackup);

      try {
        fs.copyFileSync(backupPath, currentDbPath);
        db.initialize();
        fs.unlinkSync(tempBackup);
        return { success: true };
      } catch (restoreError) {
        fs.copyFileSync(tempBackup, currentDbPath);
        fs.unlinkSync(tempBackup);
        db.initialize();
        throw restoreError;
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // App info
  ipcMain.handle('app:getInfo', () => {
    return {
      success: true,
      data: {
        version: app.getVersion(),
        name: app.getName(),
        dataPath: app.getPath('userData')
      }
    };
  });

  // Exit kiosk mode (for admin use)
  ipcMain.handle('app:exitKiosk', (event, pin) => {
    try {
      if (db.verifyAdminPin(pin)) {
        app.quit();
        return { success: true };
      }
      return { success: false, error: 'Invalid PIN' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerIpcHandlers };
