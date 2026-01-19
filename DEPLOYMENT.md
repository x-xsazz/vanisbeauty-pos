# VanisBeauty POS - Deployment Guide

## Overview
VanisBeauty POS is a local-only, offline-capable Point of Sale system for beauty salons and parlors. This guide covers configuration, building, and deployment for Windows environments.

## System Requirements

### Minimum Requirements
- **OS**: Windows 10 (64-bit) or later
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space
- **Display**: 1280x720 minimum resolution
- **Input**: Mouse/keyboard or touchscreen display

### For Development
- **Node.js**: v18.x or later
- **npm**: v9.x or later
- **Git**: For version control (optional)

## Configuration

### Application Configuration
All application configuration is stored in `package.json`:

```json
{
  "name": "vanisbeauty-pos",
  "version": "1.0.0",
  "description": "Local-only POS system for beauty parlor",
  "main": "src/main/index.js",
  "build": {
    "appId": "com.vanisbeauty.pos",
    "productName": "VanisBeauty POS",
    "win": {
      "target": ["nsis", "portable"],
      "icon": "assets/icon.ico"
    }
  }
}
```

### Default Settings
The system comes with pre-configured defaults that can be changed through the Admin Portal:

| Setting | Default Value | Changeable |
|---------|--------------|------------|
| Business Name | "Vanis Beauty" | Yes (Admin > Settings) |
| Currency Symbol | "$" | Yes (Admin > Settings) |
| Tax Rate | 0 | Yes (Admin > Settings) |
| Admin PIN | "12345" | Yes (Admin > Settings) |
| Loyalty Rate | 1 point per $10 | No (hardcoded) |
| Auto-Save Interval | 30 seconds | No (hardcoded) |
| Staff Photos Path | "photos/" | Yes (Admin > Settings) |

### Database Configuration
- **Type**: SQLite (via sql.js)
- **Location**: `%APPDATA%\VanisBeauty POS\pos.db`
- **Auto-Save**: Every 30 seconds + on application exit
- **Backup**: Manual backup/restore via Admin Portal
- **Size**: Grows with data, typically under 50MB for small businesses

### Security Configuration
- **Kiosk Mode**: Enabled by default in production
- **Admin PIN**: Required for admin access and exiting kiosk mode
- **Default Admin PIN**: `12345` (MUST BE CHANGED IMMEDIATELY)
- **Staff PINs**: Set individually per staff member
- **Action Logging**: Enabled by default (`pos-actions.log`)

## Building the Application

### Step 1: Install Dependencies
```bash
cd C:\Users\sazza\WebstormProjects\vanisbeauty
npm install
```

### Step 2: Choose Build Type

#### Option A: NSIS Installer (Recommended for Distribution)
Builds a professional Windows installer with installation wizard:

```bash
npm run build
```

**Output**: `dist/VanisBeauty POS Setup 1.0.0.exe`

**Features**:
- Custom installation directory selection
- Start menu shortcuts
- Uninstaller included
- Windows registry integration

**File Size**: ~150-200MB

#### Option B: Portable Executable (Recommended for Testing)
Builds a standalone executable that requires no installation:

```bash
npm run build:portable
```

**Output**: `dist/VanisBeauty POS 1.0.0.exe`

**Features**:
- No installation required
- Run from USB drive or network share
- Ideal for testing or temporary deployments
- Each user gets separate database

**File Size**: ~150-200MB

### Step 3: Verify Build
Check the `dist/` folder for output files:

```bash
dir dist
```

## Deployment Scenarios

### Scenario 1: Single Store/Kiosk Deployment

**Best Method**: NSIS Installer

1. Build the installer:
   ```bash
   npm run build
   ```

2. Copy `dist/VanisBeauty POS Setup 1.0.0.exe` to the target machine

3. Run the installer on the target machine

4. Launch the application from Start Menu or Desktop shortcut

5. **IMPORTANT**: Change default admin PIN immediately:
   - Enter current PIN: `12345`
   - Go to Admin > Settings
   - Change "Admin PIN" field
   - Click "Update Settings"

6. Configure business settings:
   - Business Name
   - Currency Symbol
   - Tax Rate

7. Set up initial data:
   - Add staff members (Admin > Staff)
   - Configure service categories (Admin > Categories)
   - Add services with pricing (Admin > Services)
   - Add existing customers if migrating (Admin > Customers)

### Scenario 2: Multiple POS Terminals (Same Location)

**Challenge**: Each installation has its own local database. No built-in sync.

**Current Limitation**: This system is designed for single-terminal use. For multiple terminals, you would need:
- Shared network drive for database (not currently supported)
- Custom synchronization solution
- Migration to a client-server architecture

**Workaround for Current Version**:
1. Use ONE terminal as primary POS
2. Use other machines for admin tasks only (viewing reports)
3. Manually export/import database backups between machines

### Scenario 3: Demo/Testing Environment

**Best Method**: Portable Executable

1. Build portable version:
   ```bash
   npm run build:portable
   ```

2. Copy `dist/VanisBeauty POS 1.0.0.exe` to test machine or USB drive

3. Run directly without installation

4. Database will be created in user's AppData folder

5. To reset for fresh demo: Delete database at:
   ```
   %APPDATA%\VanisBeauty POS\pos.db
   ```

### Scenario 4: Development Environment

**Method**: Run from source

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run in development mode (with dev tools):
   ```bash
   npm run dev
   ```

3. Features in dev mode:
   - Developer tools enabled (F12)
   - Windowed mode (not fullscreen)
   - Keyboard shortcuts enabled
   - Easier debugging

4. Run in production mode (kiosk mode):
   ```bash
   npm start
   ```

## Post-Deployment Configuration

### Initial Setup Checklist

- [ ] Change default admin PIN from `12345`
- [ ] Configure business name and currency
- [ ] Set appropriate tax rate
- [ ] Add all staff members with photos
- [ ] Create service categories
- [ ] Add all services with correct pricing
- [ ] Import existing customer list (if applicable)
- [ ] Test payment flow end-to-end
- [ ] Configure staff commission rates
- [ ] Set up regular backup schedule

### Staff Setup
1. Go to Admin > Staff
2. Click "Add New Staff"
3. Fill in details:
   - Name
   - Role (Admin or Staff)
   - Commission Rate (%)
   - PIN (4 digits)
   - Photo (optional)
4. Click "Save"

### Service Setup
1. Go to Admin > Categories (optional, use defaults if preferred)
2. Create categories for organizing services
3. Go to Admin > Services
4. Click "Add New Service"
5. Fill in:
   - Service Name
   - Price
   - Category
   - Active status
   - Show on home screen (for quick access)
6. Click "Save"

### Customer Import
If migrating from another system:
1. Prepare CSV with customer data
2. Manually add via Admin > Customers > Add New
3. Or use database restore with pre-populated database

## Backup & Restore

### Manual Backup
1. Enter admin PIN
2. Go to Admin > Settings
3. Scroll to "Database Management"
4. Click "Backup Database"
5. Choose save location
6. File saved as: `pos-backup-YYYY-MM-DD-HHmmss.db`

### Restore from Backup
1. Enter admin PIN
2. Go to Admin > Settings
3. Scroll to "Database Management"
4. Click "Restore Database"
5. Select backup file
6. Confirm restoration
7. Application will reload with restored data

### Recommended Backup Schedule
- **Daily**: End of business day
- **Weekly**: Full backup to external drive
- **Before Updates**: Always backup before upgrading

## Updating the Application

### For Installed Versions (NSIS)
1. Backup database first
2. Build new version with updated version number in `package.json`
3. Run new installer
4. Installer will upgrade existing installation
5. Database is preserved (stored in AppData)

### For Portable Versions
1. Backup database
2. Replace old .exe with new version
3. Database is automatically used (stored in AppData)

## Troubleshooting

### Application Won't Start
- **Check**: Windows Defender or antivirus blocking
- **Solution**: Add exception for VanisBeauty POS
- **Check**: Insufficient disk space
- **Solution**: Free up at least 500MB

### Database Not Saving
- **Check**: Permissions on AppData folder
- **Solution**: Run as administrator once to initialize
- **Check**: Disk full
- **Solution**: Free up disk space

### Stuck in Fullscreen/Kiosk Mode
- **Solution**: Press Ctrl+P to bring up PIN dialog
- **Enter**: Admin PIN to exit kiosk mode
- **Alternative**: Press Alt+Tab to switch windows, then close from taskbar

### Cannot Access Admin Portal
- **Issue**: Forgot admin PIN
- **Solution**: Database modification required (contact support)
- **Prevention**: Write down PIN in secure location

### Performance Issues
- **Check**: Database size (>100MB)
- **Solution**: Archive old data, start fresh database
- **Check**: Low RAM (<4GB)
- **Solution**: Close other applications
- **Check**: Running on HDD vs SSD
- **Solution**: Move to SSD for better performance

## Security Best Practices

1. **Change Default PIN**: Never use `12345` in production
2. **Unique Staff PINs**: Each staff member should have unique PIN
3. **Regular Backups**: Daily backups prevent data loss
4. **Physical Security**: Kiosk mode prevents unauthorized access
5. **Action Logs**: Review `pos-actions.log` for audit trail
6. **Update Regularly**: Keep Electron updated for security patches
7. **Network Isolation**: Keep POS terminal off public networks
8. **No Remote Access**: System has no remote access features (by design)

## Data Management

### Database Location
```
C:\Users\{USERNAME}\AppData\Roaming\VanisBeauty POS\pos.db
```

### Log Files Location
```
C:\Users\{USERNAME}\AppData\Roaming\VanisBeauty POS\pos-actions.log
```

### Staff Photos Location
```
C:\Users\{USERNAME}\AppData\Roaming\VanisBeauty POS\photos\
```

### Data Retention
- **Bills**: Stored indefinitely
- **Customers**: Stored indefinitely
- **Staff Time Logs**: Stored indefinitely
- **Action Logs**: Rotated when >10MB (automatic)

## Performance Optimization

### For Low-End Hardware
1. Reduce number of services shown on home screen
2. Archive old bills (backup and delete)
3. Limit customer database to active customers
4. Close dev tools if running in dev mode

### For High-Volume Stores
1. Regular database maintenance (backup, archive, restore)
2. Consider database size limits (~100,000 transactions)
3. Monthly archival of old data recommended

## Support & Maintenance

### Common Maintenance Tasks
- **Weekly**: Review action logs
- **Monthly**: Backup database
- **Quarterly**: Archive old transaction data
- **Yearly**: Review staff and customer lists for inactive entries

### System Requirements Updates
This application is built on Electron 40.0.0 and requires:
- Windows 10 or later
- Regular Windows updates
- .NET Framework 4.5+ (usually pre-installed)

## Additional Notes

### Offline Operation
- System works 100% offline
- No internet connection required
- No cloud dependencies
- All data stored locally

### Customization
To customize the system:
1. Modify source code in `src/` directory
2. Update styling in `src/renderer/css/main.css`
3. Replace icon at `assets/icon.ico`
4. Rebuild with `npm run build`

### Multi-Store Management
For multiple locations:
- Each location needs separate installation
- No built-in sync between locations
- Consolidate data by exporting reports to CSV
- Use database backups to migrate data between locations

## Contact & Support

- **Project Location**: `C:\Users\sazza\WebstormProjects\vanisbeauty`
- **Version**: 1.0.0
- **License**: UNLICENSED (Private use only)

## Appendix A: File Structure

```
vanisbeauty/
├── package.json                    # Build configuration
├── assets/
│   └── icon.ico                   # Application icon
└── src/
    ├── main/
    │   ├── index.js               # Electron main process
    │   ├── database.js            # Database layer
    │   └── ipc-handlers.js        # IPC handlers
    ├── preload/
    │   └── index.js               # Secure API bridge
    └── renderer/
        ├── index.html             # UI template
        ├── js/
        │   ├── app.js             # Main application logic
        │   └── state.js           # State management
        ├── css/
        │   └── main.css           # Styling
        └── fonts/
            └── CooperPlanck4-SH.ttf
```

## Appendix B: Default Database Schema

The system creates 8 tables automatically on first run:
- `services` - Service catalog
- `categories` - Service categories
- `customers` - Customer database
- `staff` - Employee records
- `bills` - Transaction records
- `bill_items` - Line items
- `staff_time_logs` - Clock in/out logs
- `reservations` - Appointment bookings
- `settings` - Application settings

See database.js for complete schema.
