# Tiny Painting Helper

Tiny Painting Helper is a lightweight browser-based practice tool for training visual proportion judgment. It is designed for drawing practice, ratio estimation, and quick perceptual warm-ups.

The app runs entirely as a static frontend. No backend, database, build step, or package installation is required.

## Features

- **Ratio estimation**
  - Estimate short-side to long-side proportions.
  - Supports fixed-ratio questions and random-ratio questions.

- **Difficulty levels**
  - `easy`: denominator precision up to 4.
  - `medium`: denominator precision up to 6.
  - `hard`: denominator precision up to 8.

- **Shape modes**
  - Rectangle ratio estimation.
  - Impossible mode for harder irregular-shape / constrained tasks.
  - Line mode for comparing two line lengths.

- **Draw mode**
  - Draw a rectangle close to a target ratio.
  - In Line mode, the app gives one colored reference line and asks you to draw the missing line.
  - Red indicates the short side; blue indicates the long side.
  - In Impossible mode with Line + Draw mode, the drag start point can be restricted to a gray dashed region, while the endpoint may go outside.

- **Answer visualization**
  - Correct and incorrect choices are highlighted after answering.
  - Rectangle draw mode shows the exact target rectangle.
  - Line mode shows red/blue segmented ratio guides.

- **Practice controls**
  - Previous / Next navigation.
  - Optional timed mode.
  - Optional random scale.
  - Collapsible options panel for small screens.

- **Documentation dialogs**
  - `helper.html` provides the in-app Help page.
  - `tutorial.html` provides the in-app Cookbook page.

## Directory structure

```text
.
├── index.html       # Main app page
├── styles.css       # App layout and visual styling
├── app.js           # Core quiz logic and canvas rendering
├── helper.html      # Help dialog content
├── tutorial.html    # Cookbook dialog content
└── README.md
```

## Local preview

Because the app loads `helper.html` and `tutorial.html` as local pages, it is best to run it through a small static server rather than opening `index.html` directly.

From the project directory:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Deployment

Tiny Painting Helper is a static site. Upload the project files to any static hosting service.

Suitable options include:

- Nginx / Apache static hosting
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- Any object-storage static site hosting

### Nginx example

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/tiny-painting-helper;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Then copy the files:

```bash
sudo mkdir -p /var/www/tiny-painting-helper
sudo cp -r ./* /var/www/tiny-painting-helper/
sudo nginx -t
sudo systemctl reload nginx
```

## How to use

1. Open the app in a browser.
2. Choose a difficulty level: `easy`, `medium`, or `hard`.
3. Open the `Options` panel to select practice modes.
4. Answer the question by choosing one of the ratio options, or by drawing when Draw mode is enabled.
5. Use `Next` to continue and `Previous` to review earlier questions.
6. Use the Help and Cookbook buttons near the title for in-app guidance.

## Mode guide

### Fixed ratio mode

The app samples a reduced integer ratio from the selected difficulty range. You choose the closest matching answer.

### Random float ratio mode

The app samples a random continuous ratio and asks you to choose the closest valid integer ratio under the selected difficulty.

### Random scale

Random scale changes the overall size of the generated visual target while preserving its ratio.

### Impossible mode

Impossible mode makes the task harder. Depending on the active mode, it may introduce irregular shapes or additional constraints such as a restricted start region for line drawing.

### Line mode

Line mode replaces rectangle comparison with line-length comparison. In normal Line mode, two line segments are generated and you estimate their short-to-long ratio.

When combined with Draw mode, the app gives one reference line:

- Red reference line: the given line is the short side.
- Blue reference line: the given line is the long side.

You draw the missing line in black.

### Draw target ratio mode

Draw mode asks you to manually draw a target proportion. The app evaluates the result using log-ratio error:

```text
error = | log(user_ratio / target_ratio) |
```

This treats overestimation and underestimation symmetrically.

## Customizing the app

### Edit the help page

Modify:

```text
helper.html
```

This page is displayed inside the Help dialog. It is a normal HTML file, so you can add richer layout, formulas, images, or interactive examples.

### Edit the cookbook page

Modify:

```text
tutorial.html
```

This page is displayed inside the Cookbook dialog and can be expanded into a fuller tutorial.

### Adjust ratios or difficulty

The main logic is in:

```text
app.js
```

Useful constants are near the top of the file, including difficulty precision, drawing tolerance, and canvas settings.

### Adjust styling

Modify:

```text
styles.css
```

The layout is responsive and includes mobile-friendly controls, collapsible options, and touch drawing support.

## Browser support

The app uses standard browser APIs:

- HTML Canvas
- Pointer Events
- CSS responsive layout
- Static iframe content for Help and Cookbook dialogs

Modern versions of Chrome, Edge, Firefox, and Safari should work.

## License

Add your preferred license here, for example MIT, Apache-2.0, or a custom research/demo license.
