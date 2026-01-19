const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.SQL = null;
    this.saveInterval = null;
  }

  getDbPath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'pos.db');
  }

  async initialize() {
    try {
      this.dbPath = this.getDbPath();

      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Initialize SQL.js
      this.SQL = await initSqlJs();

      // Load existing database or create new
      if (fs.existsSync(this.dbPath)) {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(fileBuffer);
      } else {
        this.db = new this.SQL.Database();
      }

      this.createTables();
      this.seedDefaultData();

      // Auto-save every 30 seconds
      this.saveInterval = setInterval(() => this.save(), 30000);

      console.log('Database initialized at:', this.dbPath);
      return true;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  save() {
    try {
      if (this.db && this.dbPath) {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
      }
    } catch (error) {
      console.error('Database save error:', error);
    }
  }

  createTables() {
    this.db.run(`
      -- Services table
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        category TEXT NOT NULL DEFAULT 'General',
        show_on_home INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);

    this.db.run(`
      -- Categories table
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        display_order INTEGER DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1
      );
    `);

    this.db.run(`
      -- Customers table
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT UNIQUE,
        email TEXT,
        loyalty_points INTEGER DEFAULT 0,
        visits INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);

    this.db.run(`
      -- Staff table
      CREATE TABLE IF NOT EXISTS staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        commission_rate REAL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        pin TEXT,
        role TEXT DEFAULT 'staff',
        photo_path TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);

    this.db.run(`
      -- Bills table
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        subtotal REAL NOT NULL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        discount_type TEXT,
        total REAL NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL,
        payment_status TEXT DEFAULT 'completed',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );
    `);

    this.db.run(`
      -- Bill items table
      CREATE TABLE IF NOT EXISTS bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        service_name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER DEFAULT 1,
        staff_id INTEGER,
        staff_name TEXT,
        notes TEXT,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES services(id),
        FOREIGN KEY (staff_id) REFERENCES staff(id)
      );
    `);

    this.db.run(`
      -- Staff time logs
      CREATE TABLE IF NOT EXISTS staff_time_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        staff_id INTEGER NOT NULL,
        clock_in TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        clock_out TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (staff_id) REFERENCES staff(id)
      );
    `);

    this.db.run(`
      -- Reservations
      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT,
        customer_phone TEXT,
        staff_id INTEGER,
        service_name TEXT,
        notes TEXT,
        status TEXT DEFAULT 'scheduled',
        start_time TEXT NOT NULL,
        end_time TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (staff_id) REFERENCES staff(id)
      );
    `);

    this.db.run(`
      -- Settings table
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Create indexes
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_bills_created ON bills(created_at);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_staff_time_logs_staff ON staff_time_logs(staff_id);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_staff_time_logs_clock_in ON staff_time_logs(clock_in);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_reservations_start_time ON reservations(start_time);`);

    this.ensureColumn('services', 'show_on_home', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('staff', 'photo_path', 'TEXT');

    this.run("UPDATE categories SET display_order = 7 WHERE name = 'Other' AND display_order = 99");
  }

  seedDefaultData() {
    const existingCategories = this.get('SELECT COUNT(*) as count FROM categories');

    if (existingCategories.count === 0) {
      const defaultCategories = [
        ['HOME', 0],  // Admin-editable home category
        ['Hair', 1], ['Facial', 2], ['Makeup', 3],
        ['Waxing', 4], ['Other', 5]
      ];
      defaultCategories.forEach(cat => {
        this.run('INSERT INTO categories (name, display_order) VALUES (?, ?)', cat);
      });
    }

    const existingServices = this.get('SELECT COUNT(*) as count FROM services');

    if (existingServices.count === 0) {
      const defaultServices = [
        ['Haircut - Women', 50, 'Hair'],
        ['Haircut - Men', 30, 'Hair'],
        ['Hair Color', 80, 'Hair'],
        ['Highlights', 120, 'Hair'],
        ['Blowout', 40, 'Hair'],
        ['Facial - Basic', 60, 'Facial'],
        ['Facial - Deep Clean', 85, 'Facial'],
        ['Makeup - Basic', 50, 'Makeup'],
        ['Makeup - Bridal', 150, 'Makeup'],
        ['Eyebrow Wax', 15, 'Waxing'],
        ['Lip Wax', 10, 'Waxing'],
        ['Full Leg Wax', 60, 'Waxing']
      ];
      defaultServices.forEach(svc => {
        this.run('INSERT INTO services (name, price, category, show_on_home) VALUES (?, ?, ?, ?)', [...svc, 0]);
      });
    }

    const existingStaff = this.get('SELECT COUNT(*) as count FROM staff');

    if (existingStaff.count === 0) {
      this.run('INSERT INTO staff (name, commission_rate, role, pin, photo_path) VALUES (?, ?, ?, ?, ?)',
        ['Admin', 0, 'admin', '12345', null]);
      this.run('INSERT INTO staff (name, commission_rate, role, pin, photo_path) VALUES (?, ?, ?, ?, ?)',
        ['Staff 1', 10, 'staff', null, null]);
      this.run('INSERT INTO staff (name, commission_rate, role, pin, photo_path) VALUES (?, ?, ?, ?, ?)',
        ['Staff 2', 10, 'staff', null, null]);
    }

    const existingSettings = this.get('SELECT COUNT(*) as count FROM settings');

    if (existingSettings.count === 0) {
      this.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['business_name', 'VanisBeauty']);
      this.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['admin_pin', '12345']);
      this.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['currency_symbol', '$']);
      this.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['tax_rate', '0']);
    }

    this.save();
  }

  // Helper methods
  run(sql, params = []) {
    this.db.run(sql, params);
    return { lastInsertRowid: this.db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] };
  }

  ensureColumn(tableName, columnName, definition) {
    const columns = this.all(`PRAGMA table_info(${tableName})`);
    const exists = columns.some(col => col.name === columnName);
    if (!exists) {
      this.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  }

  get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  // Service methods
  getServices(activeOnly = true) {
    this.ensureColumn('services', 'show_on_home', 'INTEGER NOT NULL DEFAULT 0');
    const query = activeOnly
      ? 'SELECT * FROM services WHERE active = 1 ORDER BY category, name'
      : 'SELECT * FROM services ORDER BY category, name';
    return this.all(query);
  }

  getServicesByCategory(category) {
    this.ensureColumn('services', 'show_on_home', 'INTEGER NOT NULL DEFAULT 0');
    return this.all('SELECT * FROM services WHERE category = ? AND active = 1 ORDER BY name', [category]);
  }

  getService(id) {
    this.ensureColumn('services', 'show_on_home', 'INTEGER NOT NULL DEFAULT 0');
    return this.get('SELECT * FROM services WHERE id = ?', [id]);
  }

  createService(data) {
    this.ensureColumn('services', 'show_on_home', 'INTEGER NOT NULL DEFAULT 0');
    const result = this.run(
      'INSERT INTO services (name, price, category, show_on_home, active) VALUES (?, ?, ?, ?, ?)',
      [data.name, data.price, data.category, data.show_on_home ?? 0, data.active ?? 1]
    );
    this.save();
    return { id: result.lastInsertRowid, ...data };
  }

  updateService(id, data) {
    this.ensureColumn('services', 'show_on_home', 'INTEGER NOT NULL DEFAULT 0');
    const name = data.name === undefined ? null : data.name;
    const price = data.price === undefined ? null : data.price;
    const category = data.category === undefined ? null : data.category;
    const showOnHome = data.show_on_home === undefined ? null : data.show_on_home;
    const active = data.active === undefined ? null : data.active;
    this.run(`
      UPDATE services SET
        name = COALESCE(?, name),
        price = COALESCE(?, price),
        category = COALESCE(?, category),
        show_on_home = COALESCE(?, show_on_home),
        active = COALESCE(?, active),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [name, price, category, showOnHome, active, id]);
    this.save();
    return this.getService(id);
  }

  deleteService(id) {
    this.run('UPDATE services SET active = 0 WHERE id = ?', [id]);
    this.save();
  }

  // Category methods
  getCategories(activeOnly = true) {
    const query = activeOnly
      ? 'SELECT * FROM categories WHERE active = 1 ORDER BY display_order'
      : 'SELECT * FROM categories ORDER BY display_order';
    return this.all(query);
  }

  createCategory(data) {
    const result = this.run(
      'INSERT INTO categories (name, display_order) VALUES (?, ?)',
      [data.name, data.display_order ?? 0]
    );
    this.save();
    return { id: result.lastInsertRowid, ...data };
  }

  deleteCategory(id) {
    const category = this.get('SELECT * FROM categories WHERE id = ?', [id]);
    if (!category) {
      return;
    }
    if (String(category.name).toUpperCase() === 'HOME') {
      throw new Error('Home category cannot be deleted');
    }

    this.run('UPDATE services SET active = 0, show_on_home = 0 WHERE category = ?', [category.name]);
    this.run('DELETE FROM categories WHERE id = ?', [id]);
    this.save();
    this.logAction('category_deleted', {
      category_id: id,
      name: category.name
    });
  }

  // Customer methods
  getCustomers() {
    return this.all('SELECT * FROM customers ORDER BY name');
  }

  searchCustomers(query) {
    return this.all(
      `SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name LIMIT 20`,
      [`%${query}%`, `%${query}%`]
    );
  }

  getCustomer(id) {
    return this.get('SELECT * FROM customers WHERE id = ?', [id]);
  }

  createCustomer(data) {
    const result = this.run(
      'INSERT INTO customers (name, phone, email, notes) VALUES (?, ?, ?, ?)',
      [data.name, data.phone || null, data.email || null, data.notes || null]
    );
    this.save();
    return { id: result.lastInsertRowid, ...data, loyalty_points: 0, visits: 0 };
  }

  updateCustomer(id, data) {
    this.run(`
      UPDATE customers SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        notes = COALESCE(?, notes),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [data.name, data.phone, data.email, data.notes, id]);
    this.save();
    return this.getCustomer(id);
  }

  incrementCustomerVisits(id, loyaltyPoints = 0) {
    this.run(`
      UPDATE customers SET
        visits = visits + 1,
        loyalty_points = loyalty_points + ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [loyaltyPoints, id]);
  }

  deleteCustomer(id) {
    const customer = this.getCustomer(id);
    this.run('UPDATE bills SET customer_id = NULL WHERE customer_id = ?', [id]);
    this.run('DELETE FROM customers WHERE id = ?', [id]);
    this.save();
    this.logAction('customer_deleted', {
      customer_id: id,
      name: customer?.name || null,
      phone: customer?.phone || null
    });
  }

  // Staff methods
  getStaff(activeOnly = true) {
    this.ensureColumn('staff', 'photo_path', 'TEXT');
    const query = activeOnly
      ? 'SELECT id, name, commission_rate, active, role, photo_path FROM staff WHERE active = 1 ORDER BY name'
      : 'SELECT id, name, commission_rate, active, role, photo_path FROM staff ORDER BY name';
    return this.all(query);
  }

  getStaffMember(id) {
    this.ensureColumn('staff', 'photo_path', 'TEXT');
    return this.get('SELECT id, name, commission_rate, active, role, photo_path FROM staff WHERE id = ?', [id]);
  }

  createStaff(data) {
    this.ensureColumn('staff', 'photo_path', 'TEXT');
    const result = this.run(
      'INSERT INTO staff (name, commission_rate, role, pin, photo_path) VALUES (?, ?, ?, ?, ?)',
      [data.name, data.commission_rate ?? 0, data.role ?? 'staff', data.pin || null, data.photo_path || null]
    );
    this.save();
    return { id: result.lastInsertRowid, ...data };
  }

  updateStaff(id, data) {
    this.ensureColumn('staff', 'photo_path', 'TEXT');
    const name = data.name === undefined ? null : data.name;
    const commissionRate = data.commission_rate === undefined ? null : data.commission_rate;
    const active = data.active === undefined ? null : data.active;
    const role = data.role === undefined ? null : data.role;
    const photoPath = data.photo_path === undefined ? null : data.photo_path;
    this.run(`
      UPDATE staff SET
        name = COALESCE(?, name),
        commission_rate = COALESCE(?, commission_rate),
        active = COALESCE(?, active),
        role = COALESCE(?, role),
        photo_path = COALESCE(?, photo_path)
      WHERE id = ?
    `, [name, commissionRate, active, role, photoPath, id]);
    this.save();
    return this.getStaffMember(id);
  }

  // Staff time logs
  getStaffClockStatus(staffId, date) {
    const openLog = this.get(`
      SELECT * FROM staff_time_logs
      WHERE staff_id = ? AND date(clock_in) = date(?) AND clock_out IS NULL
      ORDER BY clock_in DESC LIMIT 1
    `, [staffId, date]);

    const firstClock = this.get(`
      SELECT MIN(clock_in) as clock_in
      FROM staff_time_logs
      WHERE staff_id = ? AND date(clock_in) = date(?)
    `, [staffId, date]);

    const lastClock = this.get(`
      SELECT MAX(clock_out) as clock_out
      FROM staff_time_logs
      WHERE staff_id = ? AND date(clock_in) = date(?)
    `, [staffId, date]);

    return {
      openLog,
      firstClockIn: firstClock?.clock_in || null,
      lastClockOut: lastClock?.clock_out || null
    };
  }

  clockInStaff(staffId) {
    const result = this.run(
      `INSERT INTO staff_time_logs (staff_id, clock_in) VALUES (?, datetime('now', 'localtime'))`,
      [staffId]
    );
    this.save();
    return { id: result.lastInsertRowid, staff_id: staffId };
  }

  clockOutStaff(logId) {
    this.run(
      `UPDATE staff_time_logs SET clock_out = datetime('now', 'localtime') WHERE id = ?`,
      [logId]
    );
    this.save();
    return this.get('SELECT * FROM staff_time_logs WHERE id = ?', [logId]);
  }

  // Bill methods
  createBill(data) {
    const billResult = this.run(`
      INSERT INTO bills (customer_id, subtotal, discount_amount, discount_type, total, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.customer_id,
      data.subtotal,
      data.discount_amount || 0,
      data.discount_type,
      data.total,
      data.payment_method,
      data.notes || null
    ]);

    const billId = billResult.lastInsertRowid;

    for (const item of data.items) {
      this.run(`
        INSERT INTO bill_items (bill_id, service_id, service_name, price, quantity, staff_id, staff_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        billId,
        item.service_id,
        item.service_name,
        item.price,
        item.quantity || 1,
        item.staff_id || null,
        item.staff_name || null,
        item.notes || null
      ]);
    }

    if (data.customer_id) {
      const loyaltyPoints = Math.floor(data.total / 10);
      this.incrementCustomerVisits(data.customer_id, loyaltyPoints);
    }

    this.save();
    return this.getBill(billId);
  }

  getBill(id) {
    const bill = this.get(`
      SELECT b.*, c.name as customer_name, c.phone as customer_phone
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `, [id]);

    if (bill) {
      bill.items = this.all('SELECT * FROM bill_items WHERE bill_id = ?', [id]);
    }

    return bill;
  }

  getBills(options = {}) {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    let query = `
      SELECT b.*, c.name as customer_name
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
    `;

    const params = [];

    if (startDate && endDate) {
      query += ' WHERE date(b.created_at) BETWEEN date(?) AND date(?)';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.all(query, params);
  }

  // Reports
  getDailySummary(date) {
    const summary = this.get(`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(total), 0) as total_sales,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(AVG(total), 0) as average_sale
      FROM bills
      WHERE date(created_at) = date(?)
    `, [date]);

    const byPaymentMethod = this.all(`
      SELECT payment_method, COUNT(*) as count, SUM(total) as total
      FROM bills
      WHERE date(created_at) = date(?)
      GROUP BY payment_method
    `, [date]);

    const topServices = this.all(`
      SELECT bi.service_name, SUM(bi.quantity) as quantity, SUM(bi.price * bi.quantity) as revenue
      FROM bill_items bi
      JOIN bills b ON bi.bill_id = b.id
      WHERE date(b.created_at) = date(?)
      GROUP BY bi.service_id
      ORDER BY quantity DESC
      LIMIT 10
    `, [date]);

    return { ...summary, byPaymentMethod, topServices };
  }

  getDailyJobs(date) {
    return this.all(`
      SELECT
        bi.service_name,
        bi.quantity,
        bi.staff_name,
        b.created_at,
        COALESCE(s.category, 'Uncategorized') as category
      FROM bill_items bi
      JOIN bills b ON bi.bill_id = b.id
      LEFT JOIN services s ON bi.service_id = s.id
      WHERE date(b.created_at) = date(?)
      ORDER BY b.created_at DESC, bi.id DESC
    `, [date]);
  }

  getStaffDailyReport(date, useNowForOpenLogs = false) {
    const staff = this.all('SELECT id, name, active, role FROM staff ORDER BY name');

    const salesRows = this.all(`
      SELECT bi.staff_id, bi.staff_name,
             SUM(bi.quantity) as jobs_count,
             SUM(bi.price * bi.quantity) as total_sales
      FROM bill_items bi
      JOIN bills b ON bi.bill_id = b.id
      WHERE date(b.created_at) = date(?) AND bi.staff_id IS NOT NULL
      GROUP BY bi.staff_id
    `, [date]);

    const paymentsRows = this.all(`
      SELECT bi.staff_id, b.payment_method,
             SUM(bi.price * bi.quantity) as total,
             SUM(bi.quantity) as jobs_count
      FROM bill_items bi
      JOIN bills b ON bi.bill_id = b.id
      WHERE date(b.created_at) = date(?) AND bi.staff_id IS NOT NULL
      GROUP BY bi.staff_id, b.payment_method
      ORDER BY b.payment_method
    `, [date]);

    const timeRows = this.all(`
      SELECT staff_id,
             MIN(clock_in) as first_clock_in,
             MAX(clock_out) as last_clock_out,
             SUM(
               (julianday(
                 CASE
                   WHEN clock_out IS NULL AND ? = 1 THEN datetime('now', 'localtime')
                   ELSE clock_out
                 END
               ) - julianday(clock_in)) * 24 * 60
             ) as total_minutes
      FROM staff_time_logs
      WHERE date(clock_in) = date(?)
      GROUP BY staff_id
    `, [useNowForOpenLogs ? 1 : 0, date]);

    const salesMap = new Map(salesRows.map(row => [row.staff_id, row]));
    const paymentsMap = new Map();
    paymentsRows.forEach(row => {
      if (!paymentsMap.has(row.staff_id)) {
        paymentsMap.set(row.staff_id, []);
      }
      paymentsMap.get(row.staff_id).push({
        method: row.payment_method,
        total: row.total || 0,
        jobs_count: row.jobs_count || 0
      });
    });
    const timeMap = new Map(timeRows.map(row => [row.staff_id, row]));

    return staff.map(member => {
      const sales = salesMap.get(member.id) || {};
      const time = timeMap.get(member.id) || {};
      return {
        staff_id: member.id,
        staff_name: member.name,
        active: member.active,
        role: member.role,
        jobs_count: sales.jobs_count || 0,
        total_sales: sales.total_sales || 0,
        payments: paymentsMap.get(member.id) || [],
        first_clock_in: time.first_clock_in || null,
        last_clock_out: time.last_clock_out || null,
        total_minutes: time.total_minutes || 0
      };
    });
  }

  getReservationsByDate(date) {
    return this.all(`
      SELECT r.*, s.name as staff_name
      FROM reservations r
      LEFT JOIN staff s ON r.staff_id = s.id
      WHERE date(r.start_time) = date(?)
      ORDER BY r.start_time ASC
    `, [date]);
  }

  // Settings
  getSetting(key) {
    const result = this.get('SELECT value FROM settings WHERE key = ?', [key]);
    return result ? result.value : null;
  }

  setSetting(key, value) {
    this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    this.save();
  }

  getSettings() {
    const rows = this.all('SELECT * FROM settings');
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    return settings;
  }

  verifyAdminPin(pin) {
    const adminPin = this.getSetting('admin_pin');
    console.log('PIN Verification:', {
      inputPin: pin,
      inputType: typeof pin,
      storedPin: adminPin,
      storedType: typeof adminPin,
      match: pin === adminPin
    });
    return pin === adminPin;
  }

  logAction(action, details = {}) {
    try {
      const logBasePath = this.dbPath ? path.dirname(this.dbPath) : app.getPath('userData');
      const logPath = path.join(logBasePath, 'pos-actions.log');
      const entry = {
        timestamp: new Date().toISOString(),
        action,
        ...details
      };
      fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
    } catch (error) {
      console.error('Failed to write action log:', error);
    }
  }

  // Backup
  async backup(destPath) {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(destPath, buffer);
    return true;
  }

  close() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }
}

module.exports = Database;
