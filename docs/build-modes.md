# Build Modes

Floppy Worm can run in different modes depending on how it's built and deployed.

## Detection

The game automatically detects which mode it's running in:

### 1. **Static Build** (Production)
- Built with `npm run build` using `vite.config.prod.ts`
- No API routes included (maps.*, api.*, $.tsx ignored)
- Map Editor UI is hidden
- Maps loaded from bundled registry only
- Cannot save or edit maps

### 2. **Server Mode** (Development)
- Built with `npm run dev` using standard `vite.config.ts`
- Full API available at `/api/maps/*`
- Root URL (`/`) redirects to map editor (`/maps`)
- Game available at `/game` route
- Maps loaded from API first, then registry fallback
- Can create, edit, and save maps
- TAB key toggles between play and edit modes

## Usage

### Import the utilities

```javascript
import { getBuildMode, getCurrentConfig, hasAPISupport } from '../utils/buildMode';
```

### Check if API is available

```javascript
const hasAPI = await hasAPISupport();
if (hasAPI) {
    // Can use API endpoints
} else {
    // Static build - use bundled data only
}
```

### Get current mode

```javascript
const mode = await getBuildMode(); // 'static' | 'server' | 'editor'
```

### Get configuration

```javascript
const config = await getCurrentConfig();
console.log(config);
// {
//   mode: 'server',
//   hasMapEditor: true,
//   hasAPI: true,
//   canSaveMaps: true,
//   mapSource: 'api'
// }
```

## How It Works

1. **API Detection**: Tries to fetch `/api/maps` with a HEAD request
   - If successful → Server mode
   - If fails → Static mode

2. **Editor Detection**: Checks for editor-specific globals
   - `window.serverMapData`
   - `window.saveMap`
   - `window.mapEditorScene`

3. **Automatic Behavior**:
   - `MapLoader` checks API availability before trying to fetch
   - `MainGame` only shows Map Editor link when API is detected
   - `MapDataRegistry` loads from API when available, static registry otherwise

## Build Commands

- **Development Server**: `npm run dev`
  - Full functionality
  - API routes available
  - Map editor enabled

- **Production Build**: `npm run build`
  - Static files only
  - No server required
  - Game-only mode

## Deployment

### Static Hosting (GitHub Pages, Netlify, etc.)
- Use `npm run build`
- Deploy the `dist` folder
- Game will run in static mode automatically

### Server Deployment (Node.js, Docker, etc.)
- Use regular build without prod config
- Ensure API routes are available
- Game will detect API and enable full features