# SpaceFarer Ship Builder

A simple click-to-place ship layout tool.

## Structure
- `index.html` — HTML shell
- `style.css` — styles
- `room-library.js` — room templates (global `window.ROOM_LIBRARY`)
- `script.js` — app logic (renders UI, manages state)
- `assets/` — static assets (favicon)

## Run
Open `index.html` in a browser, or serve the folder via a local server for clipboard access and cleaner URLs.

### Windows (PowerShell)
```powershell
Start-Process msedge "$(Resolve-Path .)\index.html"
```

### Python HTTP server (optional)
```powershell
python -m http.server 5500 ; Start-Process http://localhost:5500/
```

## Export/Import
- Export copies JSON to clipboard and shows a prompt with the JSON.
- Import accepts pasted JSON from a prior export.
