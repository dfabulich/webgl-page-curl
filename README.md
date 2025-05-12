# webgl-page-curl

`webgl-page-curl` lets you do a page-curl animation of a DOM element, peeling back the current content to replace it with the next page.

It works by first taking a screenshot of the element, rendering that into a `<canvas>` on top of the element, and doing a WebGL animation on that `<canvas>` to make the screenshot appear to peel/curl away, revealing the element below.

https://github.com/user-attachments/assets/384ff44c-a962-4b54-afb4-f8c6f77a3f85

## Prerequisites

### Prerequisite: Load dependencies (it's weird, sorry)

`webgl-page-curl` depends on [`three.js`](https://threejs.org/), and has an an optional but strongly recommended dependency on [`html2canvas`](https://html2canvas.hertzen.com/).

In the `example.html` file, we load `three.js` and `html2canvas` like this:

```js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import html2canvas from 'https://esm.sh/html2canvas';
```

Since `webgl-page-curl` is designed to run in the browser, there are a variety of different ways _you_ might want to load your dependencies: via unpkg (with or without an import map), via a checked-in file, or via your own bundler.

However you do it, you'll need to pass your `THREE` object and your `html2canvas` object to `webgl-page-curl`; we'll take it from there.

### Prerequisite: Take a screenshot of the DOM element

Unfortunately, the browser has no API for taking a screenshot of a DOM element, so you'll have to use `html2canvas` to do it. `html2canvas` is simulating a browser; it's rendering may not be a perfect match for the content you want to animate.

`webgl-page-curl` exports a function `captureScreenshotOfParentElement(element, html2canvas, options = {logging: false})` to take the screenshot. It takes the screenshot of the _parent_ of the element you pass, because that way, if the parent element is smaller than the element itself, we'll take a screenshot of that smaller, reduced shape. (If your parent element is the body, then we'll just take a screenshot of the entire page.)

`html2canvas` returns a `<canvas>` element,

Use it like this:

```js
import html2canvas from 'https://esm.sh/html2canvas';
import { captureScreenshotOfParentElement } from 'webgl-page-curl';
const screenshotCanvas = await captureScreenshotOfParentElement(element, html2canvas);
```

If you find another/better way to take a screenshot instead of `html2canvas`, feel free to use it, passing your screenshot to the `curl()` function.

### Prerequisite: Ensure the parent element is a curl container

The element you're curling must have a "curl container" parent element. The parent can either be the `document.body` or any element with `position: relative`.

(If the parent isn't the body, then parent element must use `position: relative`, because we'll position the curl `<canvas>` with `position: absolute` relative to your element's parent.)

# Curling the page

Once you have a `screenshotCanvas`, you can invoke the `curl` function like this:

```js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { curl } from 'webgl-page-curl';
await curl({
  THREE: THREE,
  element: element,
  durationInMs: 1000,
  screenshotCanvas: screenshotCanvas,
  nextPageContent: nextPageContent,
});
```

The `nextPageContent` can either be a string of HTML to set on `element.innerHTML`, or it can be a callback function accepting the `element` as its only parameter. The function can then configure whatever HTML it wants in the updated element.

## How it works

1. `curl()` will start by converting your `screenshotCanvas` into a `three.js` `<canvas>` containing your screenshot on a plane
2. We'll append that `<canvas>` as a sibling of your `element`, using `position: absolute`, `top: 0, left: 0`, with a `z-index` above your element. (Thus, your element's parent must either be the `document.body` or must have `position: relative`.)
   At this point, the user will no longer see your element, but will see a screenshot of your element. (Hopefully the user won't notice, but `html2canvas` is by no means perfect.)
3. Then, we'll replace the `element`'s content with the `nextPageContent`.
   The user won't see your updated content yet, because it's still behind the screenshot.
4. Then, we'll begin a WebGL animation, curling the `<canvas>` and revealing the updated element behind it.
5. Finally, we'll remove the `<canvas>` from the DOM and resolve the promise.
