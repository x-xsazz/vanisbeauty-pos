# Auto-Update Setup Guide

Your VanisBeauty POS app is now configured for automatic updates over the internet using GitHub Releases.

## How It Works

- The app checks for updates 3 seconds after startup
- Updates download automatically in the background
- When ready, users see a dialog to restart and install
- Updates only work in production builds (not in dev mode)

## Setup Steps

### 1. Create a GitHub Repository

Replace `YOUR_USERNAME` in `package.json` with your actual GitHub username:

```json
"repository": {
  "type": "git",
  "url": "https://github.com/YOUR_USERNAME/vanisbeauty-pos.git"
},
"build": {
  "publish": {
    "provider": "github",
    "owner": "YOUR_USERNAME",
    "repo": "vanisbeauty-pos"
  }
}
```

### 2. Create a GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name like "VanisBeauty Releases"
4. Check the `repo` scope (full control of private repositories)
5. Generate and copy the token

### 3. Set the Token as Environment Variable

**Windows (PowerShell):**
```powershell
$env:GH_TOKEN="your_token_here"
```

**Windows (Command Prompt):**
```cmd
set GH_TOKEN=your_token_here
```

Or add it permanently:
1. Search "Environment Variables" in Windows
2. Add new system variable: `GH_TOKEN` = `your_token_here`

### 4. Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vanisbeauty-pos.git
git push -u origin main
```

## Publishing Updates

### First Release (v1.0.0)

```bash
npm run publish
```

This will:
1. Build the app
2. Create a GitHub release with tag v1.0.0
3. Upload the installer files

### Subsequent Releases

1. Update version in `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. Commit the change:
   ```bash
   git add package.json
   git commit -m "Bump version to 1.0.1"
   git push
   ```

3. Publish:
   ```bash
   npm run publish
   ```

## What Gets Published

- `VanisBeauty POS Setup 1.0.0.exe` - NSIS installer
- `VanisBeauty POS 1.0.0.exe` - Portable version
- `latest.yml` - Update metadata file (critical for auto-updates)

## User Experience

1. User starts the app
2. App checks for updates in the background
3. If update found, it downloads silently
4. Dialog appears: "A new version has been downloaded"
5. User clicks "Restart Now" or "Later"
6. If "Restart Now", app closes and installs the update

## Troubleshooting

### Updates not working?

1. Check console logs for errors
2. Verify `latest.yml` exists in GitHub release
3. Ensure `GH_TOKEN` is set correctly
4. Make sure version in `package.json` is higher than current

### Testing updates locally

You can't test auto-updates in dev mode. To test:

1. Build and install v1.0.0
2. Publish v1.0.1 to GitHub
3. Run the installed v1.0.0 app
4. It should detect and download v1.0.1

## Advanced Configuration

### Change update check frequency

In `src/main/index.js`, modify the timeout:

```javascript
setTimeout(() => {
  autoUpdater.checkForUpdates();
}, 3000); // 3 seconds after startup
```

### Add manual update check

You can add a menu item or button that calls:

```javascript
autoUpdater.checkForUpdates();
```

### Customize update dialog

The update dialog is in `src/main/index.js` at line 105:

```javascript
dialog.showMessageBox(mainWindow, {
  type: 'info',
  title: 'Update Ready',
  message: 'A new version has been downloaded.',
  detail: `Version ${info.version} is ready to install.`,
  buttons: ['Restart Now', 'Later']
})
```

## Security Notes

- Never commit your `GH_TOKEN` to git
- The token grants full repo access, keep it safe
- Users don't need the token, only the publisher does
- Updates are signed automatically by electron-builder

## Version Numbering

Follow semantic versioning:
- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features
- **Patch** (1.0.0 → 1.0.1): Bug fixes
