# Rectangle / AABB Ratio Trainer — Frontend JS Version

This is a static frontend implementation of the original Python/Tkinter ratio training program.

## Files

```text
ratio-trainer-js
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Features

- Fixed ratio mode
- Random float ratio mode
- Timed mode
- Random area scaling
- Rotated rectangle questions
- Random complex polygon AABB questions
- Draw target ratio mode
- Previous / next navigation
- Canvas-based rendering with high-DPI support

## Local preview

Open `index.html` directly in a browser, or run a local static server:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Deployment

Because this is a pure static frontend, you can deploy the whole folder to any static server.

### Nginx example

Copy the folder to your web root:

```bash
sudo mkdir -p /var/www/ratio-trainer
sudo cp -r ./* /var/www/ratio-trainer/
```

Example Nginx config:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/ratio-trainer;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### GitHub Pages / Vercel / Netlify

Upload `index.html`, `styles.css`, and `app.js` as a static site. No backend is required.


## Mobile UI adaptation

The page uses responsive CSS:

- The canvas scales to the available screen width while preserving the internal 760×460 coordinate system.
- Options collapse from a 2-column layout to a single-column touch-friendly layout on phones.
- The bottom navigation becomes two equal-width buttons on phones.
- The drawing canvas disables default touch gestures while drawing, so drag-to-draw works on mobile browsers.
- Safe-area padding is included for iOS-style notches.
