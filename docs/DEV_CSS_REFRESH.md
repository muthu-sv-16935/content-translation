# Why CSS changes don’t show on localhost

## Two ways the app is served

| How you run | Port | What’s served | When CSS updates |
|-------------|------|----------------|------------------|
| **`npm run dev`** | **5173** (Vite) | Live source from `client/src/` with HMR | **Immediately** (no restart) |
| **`npm run dev`** | 3002 (Express) | Pre-built files from `client/dist/` | Only after **rebuild** |
| **`npm run server`** only | 3002 | Pre-built files from `client/dist/` | Only after **rebuild** |

- **Port 5173** = Vite dev server. It serves your current `App.css` and other source files and supports hot module replacement (HMR). **Use this URL while developing so CSS changes show right away.**
- **Port 3002** = Express server. It only serves the **last build** in `client/dist/`. Restarting the server does **not** rebuild the frontend, so CSS changes in `client/src/` are not included until you build again.

## What to do

### Option A – See CSS changes immediately (recommended for dev)

1. Run: **`npm run dev`**
2. Open in the browser: **http://localhost:5173** (not 3002)
3. Edit `client/src/App.css` (or any CSS) and save. Changes should appear without restarting.

### Option B – Use port 3002 and still see CSS changes

1. After changing CSS, rebuild the client: **`npm run build`**
2. If the server is already running, just refresh the page at http://localhost:3002 (or restart with `npm run server` and then refresh).
3. If the browser still shows old styles, do a **hard refresh**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac), or open DevTools → Network → check “Disable cache” and refresh.

## Summary

- **Developing and want instant CSS updates** → Run `npm run dev` and use **http://localhost:5173**.
- **Using http://localhost:3002** → Run **`npm run build`** after CSS changes, then refresh (and hard refresh if needed).
