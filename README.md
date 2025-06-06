# webgl-page-curl

`webgl-page-curl` lets you do a page-curl animation of a DOM element, peeling back the current content to replace it with the next page.

It works by first taking a screenshot of the element, rendering that into a `<canvas>` on top of the element, and doing a WebGL animation on that `<canvas>` to make the screenshot appear to peel/curl away, revealing the element below.

## Example

View a [live example](https://dfabulich.github.io/webgl-page-curl/).

https://github.com/user-attachments/assets/9dc62f56-7b83-4e66-ad66-2b6777869b3d

## Prerequisites

### Prerequisite: Take a screenshot of the DOM element

Unfortunately, the browser has no API for taking a screenshot of a DOM element. We recommend using `html2canvas` to do it, but `html2canvas` is simulating a browser; it's rendering may not be a perfect match for the content you want to animate.

`webgl-page-curl` doesn't directly depend on `html2canvas`; it's not a mandatory dependency. Instead, if you want to use `html2canvas` (and we recommend that you do!) you'll need to load `html2canvas` yourself.

`webgl-page-curl` exports a function `captureScreenshotOfParentElement(element, html2canvas, options = {logging: false})` to take the screenshot. It takes the screenshot of the _parent_ of the element you pass, because that way, if the parent element is smaller than the element itself, we'll take a screenshot of that smaller, reduced shape. (If your parent element is the body, then we'll just take a screenshot of the entire page.)

`html2canvas` returns a `<canvas>` element.

Use it like this:

```js
import html2canvas from 'https://esm.sh/html2canvas';
import { captureScreenshotOfParentElement } from 'webgl-page-curl';
const screenshotCanvas = await captureScreenshotOfParentElement(element, html2canvas);
```

If you find another/better way to take a screenshot instead of `html2canvas`, feel free to use it, passing your screenshot to the `curl()` function.

### Prerequisite: Ensure the parent element either is the `document.body` or `documentElement`, or has `position: relative`

Once we capture the screenshot, we'll create a `<canvas>` next to the curling element, with `position: absolute; left: 0; top: 0;`.

Despite the name `absolute`, a `position: absolute` element "is positioned relative to its closest positioned ancestor."

If you're animating the `document.body` or `documentElement`, the `<canvas>` will appear at the top-left corner of the screen, which is probably what you want. If you're animating another element, its parent element must have `position: relative`, to ensure that the `<canvas>` appears directly on top of it.

# Curling the page

Once you have a `screenshotCanvas`, you can invoke the `curl` function like this:

```js
import { curl } from 'webgl-page-curl';
await curl({
  element: element,
  durationInMs: 1000,
  screenshotCanvas: screenshotCanvas,
  nextPageContent: nextPageContent,
});
```

The `nextPageContent` can either be a string of HTML to set on `element.innerHTML`, or it can be a callback function accepting the `element` as its only parameter. The function can then configure whatever HTML it wants in the updated element.

## How it works

1. `curl()` will start by converting your `screenshotCanvas` into a WebGL `<canvas>` containing your screenshot on a plane
2. We'll append that `<canvas>` as a sibling of your `element`, using `position: absolute`, `top: 0, left: 0`, with a `z-index` above your element. (Thus, your element's parent must either be the `document.body` or must have `position: relative`.)

   At this point, the user will no longer see your element, but will see a screenshot of your element. (Hopefully the user won't notice, but `html2canvas` is by no means perfect.)

3. Then, we'll replace the `element`'s content with the `nextPageContent`.

   The user won't see your updated content yet, because it's still behind the screenshot.

4. Then, we'll begin a WebGL animation, curling the `<canvas>` and revealing the updated element behind it.
5. Finally, we'll remove the `<canvas>` from the DOM and resolve the promise.

## Adjusting the curl shape

You can set other curl parameters, too. Try playing around with these to see how they feel.

- `curlRadius`: The curl functions as if a cylinder were rolling over the page, with a radius you provide. The default is 0.2.
- `startX`/`startY`: We start curling from this point. In the X coordinate, 1.0 is right, 0.0 is left. In the Y coordinate, 1.0 is top, 0.0 is bottom. The curl starts at 1, 0 by default, the lower-right corner.
- `endX`/`endY`: We'll curl the cylinder toward this end point. The curl ends at 0, 1 by default, the upper-left corner.
  - Especially try playing around with `endX`. If you want to peel the page up and away, try setting `endX` closer to 1.0.
