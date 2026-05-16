# Tiny Painting Helper — Frontend JS Version

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


## Latest UI changes

- The title is now `Tiny Painting Helper`.
- The checkbox option group can be collapsed to save space, especially on mobile.
- Draw target ratio mode disables and grays out incompatible shape-generation options.
- The stats area only shows `Score:` and `Accuracy:`.


## Minimal stats display update

- Removed the `Shape` heading above the canvas.
- Removed the visible mode-description line such as `Mode: fixed ratio set ...`.
- The information area now only displays `Score:` and `Accuracy:` plus the timer only when timed mode is enabled.


## Help dialog

The title row now includes a small help icon. Clicking it opens a modal dialog rendered from Markdown-like text. Math formulas are supported through MathJax, loaded from a CDN.


## Layout cleanup update

- Removed the subtitle under the title.
- Made the help icon smaller and positioned it near the title's upper-right.
- Made the canvas full-width so it aligns with the option buttons.
- Vertically aligned the score/accuracy area with the options summary row.


## Help content file

The help dialog no longer stores its text inside `app.js`. It loads the content from:

```text
helper.md
```

You can edit `helper.md` directly to update the help text. Formulas written with MathJax syntax, such as `\(r_u\)` and `\[ ... \]`, are supported.

When previewing locally, use a static server rather than opening `index.html` directly, because browsers may block `fetch("./helper.md")` under the `file://` protocol:

```bash
python -m http.server 8080
```


## Crisp canvas update

The canvas backing bitmap now follows the actual displayed CSS size and device pixel ratio. This prevents blurry or fuzzy rectangle strokes when the responsive layout displays the canvas wider than its original 760px logical width.


## Display math fix

The Markdown renderer now collects multi-line display math blocks written with:

```text
\[
...
\]
```

and passes the whole block to MathJax. Inline math `\( ... \)` and display math are both supported.


## Checked JavaScript syntax fix

The Markdown renderer was repaired so multi-line display math blocks are supported without breaking `app.js`. The script has been checked with `node --check`.
