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

### Prerequisite: Ensure the parent element is a curl container

The element you're curling must have a "curl container" parent element. The parent can either be the `document.body` or any element with `position: relative`.

(If the parent isn't the body, then parent element must use `position: relative`, because we'll position the curl `<canvas>` with `position: absolute` relative to your element's parent.)

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
