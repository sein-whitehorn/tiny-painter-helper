### What this app trains

Tiny Painting Helper is a small visual ratio trainer. It helps you estimate the proportion of a rectangle or the axis-aligned bounding box of a polygon.

All ratio answers are written as:
$$
\text{short side} : \text{long side}
$$
So \(1:2\) and \(2:1\) are treated as the same visual proportion.

---

### Main modes

- **Fixed ratio mode**: choose from common ratios such as \(1:1\), \(4:5\), \(3:4\), \(2:3\), \(1:2\), and \(1:3\).
- **Random float ratio mode**: the program generates a random ratio, then asks you to choose the closest integer ratio.
- **Random area scale**: changes the overall size of the shape while keeping its ratio.
- **Random complex polygon mode**: asks for the ratio of the polygon's axis-aligned bounding box.
- **Draw target ratio mode**: drag on the canvas to draw a rectangle close to the target ratio.

---

### Draw mode scoring

In draw mode, the app compares your rectangle ratio \(r_u\) with the target ratio \(r_t\).

The error is measured using log-ratio error:

$$
e = \left|\log\left(\frac{r_u}{r_t}\right)\right|
$$


This is more balanced than raw difference because overestimating and underestimating a ratio are treated symmetrically.

The current tolerance is:

$$
\pm 10\%
$$


---

### Tips

- Focus on the **short side compared with the long side**, not on the absolute size.
- For rotated rectangles, ignore rotation and judge the rectangle itself.
- For polygon mode, judge the surrounding bounding box rather than the polygon area.
- In draw mode, the blue answer box keeps your shorter side fixed and adjusts the longer side to show the exact target ratio.
