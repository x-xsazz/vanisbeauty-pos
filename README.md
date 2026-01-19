<<<<<<< HEAD
# VanisBeauty POS

A local-only Point of Sale system designed for beauty salons and parlors.

## Overview
VanisBeauty POS is a Windows desktop application built with Electron that provides a complete POS solution for beauty businesses. It features an offline-first design with local SQLite storage, ensuring your data stays private and accessible even without internet connectivity.

## Features

### Point of Sale
- Touch-optimized interface for kiosk mode
- Service selection with category filtering
- Staff assignment per service
- Multiple payment methods (Cash, Card, PayID, Credit)
- Discount support (fixed amount or percentage)
- Customer lookup and association
- Real-time total calculation

### Customer Management
- Customer database with contact information
- Automatic loyalty points (1 point per $10 spent)
- Visit tracking
- Quick search by name or phone
- Customer notes

### Staff Management
- Staff profiles with photos
- Commission rate tracking
- Clock in/out time tracking
- PIN-based authentication
- Role-based access (Admin/Staff)

### Reporting
- Daily sales summary
- Staff performance reports
- Job logs by date
- Payment method breakdowns
- Reservation tracking
- CSV export for external analysis

### Administration
- PIN-protected admin portal
- Service and category management
- Business settings (name, currency, tax rate)
- Database backup and restore
- Action logging for audit trail

## System Requirements

- Windows 10 (64-bit) or later
- 4GB RAM minimum (8GB recommended)
- 500MB free disk space
- 1280x720 minimum screen resolution
- Optional: Touchscreen display for kiosk mode

## Installation

### For End Users

1. Download `VanisBeauty POS Setup 1.0.0.exe` from the `dist/` folder
2. Run the installer
3. Follow the installation wizard
4. Launch from Start Menu or Desktop shortcut

### For Portable Use

1. Download `VanisBeauty POS 1.0.0.exe` from the `dist/` folder
2. Run directly without installation
3. Database will be created in your user AppData folder

## First-Time Setup

1. Launch the application
2. **IMPORTANT**: Change the default admin PIN (currently `12345`)
   - Enter PIN to access Admin Portal
   - Go to Settings
   - Update "Admin PIN" field
   - Save changes

3. Configure business settings:
   - Business name
   - Currency symbol
   - Tax rate (if applicable)

4. Add staff members:
   - Go to Admin > Staff
   - Add staff with names, commission rates, and PINs
   - Optional: Upload staff photos

5. Set up services:
   - Go to Admin > Services
   - Add your services with pricing
   - Assign categories
   - Mark popular services for home screen

6. Add existing customers:
   - Go to Admin > Customers
   - Add customer records
   - Or add them as you process sales

## Development

### Prerequisites
- Node.js v18.x or later
- npm v9.x or later

### Setup
```bash
npm install
```

### Run in Development Mode
```bash
npm run dev
```
This runs the app in windowed mode with developer tools enabled.

### Run in Production Mode
```bash
npm start
```
This runs the app in fullscreen kiosk mode (same as built version).

### Build
```bash
npm run build         # Build NSIS installer
npm run build:portable # Build portable executable
```

Output files will be in the `dist/` directory.

## Project Structure

```
vanisbeauty/
├── src/
│   ├── main/
│   │   ├── index.js          # Electron main process
│   │   ├── database.js       # SQLite database layer
│   │   └── ipc-handlers.js   # IPC communication handlers
│   ├── preload/
│   │   └── index.js          # Secure API bridge
│   └── renderer/
│       ├── index.html        # UI template
│       ├── js/
│       │   ├── app.js        # Main application logic
│       │   └── state.js      # State management
│       ├── css/
│       │   └── main.css      # Styling (Brutalist theme)
│       └── fonts/
│           └── CooperPlanck4-SH.ttf
├── assets/
│   └── icon.ico              # Application icon (MISSING - see below)
├── dist/                     # Build output
├── package.json              # Project configuration
├── DEPLOYMENT.md             # Deployment guide
└── TEST_REPORT.md            # Testing documentation
```

## ⚠️ CRITICAL: Missing Icon

**Before deploying to production**, you MUST add an application icon:

1. Create or obtain a `.ico` file with VanisBeauty branding
2. Place it at `assets/icon.ico`
3. Rebuild with `npm run build`

Currently, the application uses the default Electron icon. See `ICON_REQUIRED.md` for details.

## Database

- **Type**: SQLite (via sql.js)
- **Location**: `%APPDATA%\VanisBeauty POS\pos.db`
- **Auto-save**: Every 30 seconds + on exit
- **Backup**: Manual via Admin > Settings

### Tables
- services
- categories
- customers
- staff
- bills
- bill_items
- staff_time_logs
- reservations
- settings

## Security

- Admin PIN protection (default: `12345` - CHANGE IMMEDIATELY)
- Kiosk mode with disabled keyboard shortcuts (production)
- Context isolation enabled
- Content Security Policy enforced
- Local-only data storage (no cloud sync)
- Action logging for audit trail

## Usage

### For Cashiers/Staff

1. Select staff member at top of screen
2. Browse or search for services
3. Tap services to add to bill
4. Optional: Look up customer or add new customer
5. Optional: Apply discount
6. Select payment method (Cash/Card/PayID/Credit)
7. Bill is recorded and receipt can be printed

### For Admins

1. Long-press the logo or click "Admin" button
2. Enter admin PIN
3. Access admin sections:
   - Services: Manage service catalog
   - Categories: Organize services
   - Customers: View and edit customer database
   - Staff: Manage employees and view time logs
   - Reports: Daily sales, staff performance, exports
   - Settings: Business configuration and backup

## Keyboard Shortcuts

**Development Mode Only:**
- F12: Open developer tools
- Ctrl+R: Reload window
- F11: Toggle fullscreen

**Production Mode:**
- Ctrl+P: PIN dialog (to exit kiosk mode)
- All other shortcuts disabled for security

## Backup & Data

### Backup
1. Go to Admin > Settings
2. Scroll to "Database Management"
3. Click "Backup Database"
4. Choose save location
5. File saved as `pos-backup-YYYY-MM-DD-HHmmss.db`

### Restore
1. Go to Admin > Settings
2. Click "Restore Database"
3. Select backup file
4. Confirm restoration
5. Application reloads with restored data

**Recommendation**: Back up daily, especially before updates.

## Troubleshooting

### Application won't start
- Check Windows Defender or antivirus isn't blocking
- Ensure 500MB+ free disk space
- Try running as administrator

### Database not saving
- Check AppData folder permissions
- Ensure sufficient disk space
- Check logs in `%APPDATA%\VanisBeauty POS\pos-actions.log`

### Stuck in fullscreen/kiosk mode
- Press Ctrl+P to bring up PIN dialog
- Enter admin PIN to exit kiosk mode
- Or use Alt+Tab to switch windows and close from taskbar

### Forgot admin PIN
- Database modification required
- Contact support or edit database directly

## Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide with configuration instructions
- [TEST_REPORT.md](TEST_REPORT.md) - Testing results and quality assessment

## License

UNLICENSED - Private use only

## Version

1.0.0

## Support

For issues or questions, please contact the development team.

---

**Built with Electron 40.0.0**
**Database: SQL.js 1.10.3**
**Build Tool: Electron Builder 23.0.6**
