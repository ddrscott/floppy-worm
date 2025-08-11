# Deployment Guide

## Static Build Deployment

### Building for Production
```bash
npm run build
```

This creates a static build in `build/client/` with:
- Single `index.html` file (SPA mode)
- All assets in `/assets/` directory
- Client-side routing for all routes

### Deploying to Vercel

1. **Automatic Configuration**: The `vercel.json` file is already configured for SPA routing:
   - All routes serve `index.html` (enables client-side routing)
   - Assets are cached for performance
   - Build command and output directory are set

2. **Deploy via CLI**:
   ```bash
   npm i -g vercel  # Install Vercel CLI if needed
   vercel          # Deploy to Vercel
   ```

3. **Deploy via GitHub**:
   - Connect your GitHub repo to Vercel
   - Vercel will automatically use `vercel.json` configuration
   - Pushes to main branch will trigger automatic deployments

### Deploying to Other Platforms

#### Netlify
Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "build/client"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### GitHub Pages
GitHub Pages doesn't support SPA routing natively. Use HashRouter or a 404.html trick.

#### AWS S3 + CloudFront
Configure CloudFront to return `index.html` for 404 errors.

### Local Testing

#### With SPA Support (Recommended)
```bash
python3 serve-static.py
```
This script properly handles SPA routing.

#### Without SPA Support
```bash
cd build/client
python3 -m http.server 8080
```
Note: Routes like `/recordings` won't work with this method.

## Development Mode

```bash
npm run dev
```

Runs the full Remix server with:
- API endpoints for map editing
- Hot module replacement
- Full server-side features

## Build Modes

- **Static Build** (`npm run build`): For deployment to static hosts
  - No API endpoints
  - Map data bundled in JavaScript
  - Recordings stored in browser IndexedDB
  
- **Server Build** (`npm run dev`): For development
  - Full API support
  - Map editor available
  - Dynamic map loading