# Extended Image Support

Display extended image formats directly in Obsidian. Currently supports HEIC/HEIF (iPhone photos), with TIFF and PSD support coming in future updates.

## Features

- 🖼️ **HEIC/HEIF Support** - View iPhone photos directly in Obsidian
- 📱 **Mobile Support** - Works on both desktop and mobile devices
- ⚡ **Live Preview** - Real-time rendering in edit mode
- 📖 **Reading Mode** - Full support for reading view

## Supported Formats

| Format | Extension | Status |
|--------|-----------|--------|
| HEIC | `.heic` | ✅ Supported |
| HEIF | `.heif` | ✅ Supported |
| TIFF | `.tiff`, `.tif` | 🚧 Coming in v2.0 |
| PSD | `.psd` | 🚧 Coming in v2.0 |

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Go to Community Plugins
3. Turn off Safe Mode
4. Click "Browse" and search for "Extended Image Support"
5. Install and enable the plugin

### Manual Installation

1. Download the latest release from GitHub
2. Extract the zip file to your vault's `.obsidian/plugins/` folder
3. Enable the plugin in Obsidian settings

## Usage

Simply embed your HEIC images as usual:

```markdown
![[photo.heic]]
![[image.heif]]
```

The plugin will automatically detect and display these formats.

## Requirements

- Obsidian v0.15.0 or higher
- iOS 14+ / Android (for HEIC on mobile)

## Performance Notes

- Large images (>10MB) may take a moment to decode
- Maximum supported image size: 10000x10000 pixels
- Decoded images are cached for better performance

## Roadmap

- [x] HEIC/HEIF support
- [ ] TIFF support (v2.0)
- [ ] PSD support (v2.0)

## License

MIT License - see [LICENSE](LICENSE) for details
