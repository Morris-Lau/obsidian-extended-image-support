# Releasing Guide

## Prerequisites

1. GitHub account
2. Obsidian account

## Step 1: Prepare GitHub Repository

1. Create a new GitHub repository named `obsidian-extended-image-support`
2. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial release v1.0.0"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/obsidian-extended-image-support.git
   git push -u origin main
   ```

## Step 2: Create a Release

1. Update `manifest.json` version number
2. Build the plugin: `npm run build`
3. Commit changes: `git commit -am "Prepare release v1.0.0"`
4. Create a tag: `git tag -a 1.0.0 -m "Version 1.0.0"`
5. Push tag: `git push origin 1.0.0`
6. On GitHub, go to Releases → Create a new release
7. Choose the tag you just created
8. Upload these files as release assets:
   - `main.js`
   - `manifest.json`

## Step 3: Submit to Obsidian Community Plugins

1. Fork [obsidian-releases](https://github.com/obsidianmd/obsidian-releases) repository
2. Edit `community-plugins.json`
3. Add your plugin entry (alphabetical order):
   ```json
   {
     "id": "extended-image-support",
     "name": "Extended Image Support",
     "author": "YOUR_NAME",
     "description": "Display HEIC/HEIF images in Obsidian (TIFF/PSD coming soon)",
     "repo": "YOUR_USERNAME/obsidian-extended-image-support"
   }
   ```
4. Create a Pull Request with title: "Add Extended Image Support plugin"
5. Wait for review (usually takes a few days)

## Requirements for Approval

- ✅ Plugin must have a valid license (MIT recommended)
- ✅ Must not modify user files without permission
- ✅ Must handle errors gracefully
- ✅ Must not cause performance issues
- ✅ Code should be well-organized

## After Approval

Your plugin will appear in Obsidian's Community Plugins browser!
Users can install it directly from Settings → Community Plugins.

## Future Updates

When adding TIFF and PSD support:
1. Update version to 2.0.0
2. Update description to include all formats
3. Update README with new features
4. Create a new release
