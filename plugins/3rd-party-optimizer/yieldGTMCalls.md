# yieldGTMCalls

_(Last reviewed in the browser November 2025)_

Google Tag Manager (GTM), Google Analytics (GA) and random other 3rd-party (3p) scripts add listeners that run when a user e.g. clicks somewhere. This is bad for INP.

To fix this, we intercept these listeners and yield to the main thread before executing their intended event handlers.

## How it works

The script **must** be added as inline script before any 3p script tag. This is needed so it can add the counter-measures before 3p install event handlers. Afterwards, you cannot intercept them anymore.

When the inline script executes, it installs:

#### `document.addEventListener` override

- for `click`, `auxclick`, `mousedown`, `keyup` and `submit`
- **The override intercepts any listener added to `document`** (see shortcomings for more on that)

#### `MutationObserver` that waits for `dataLayer` to appear

- We need to wait for `dataLayer` to appear, so that the initial pushes happen as expected (e.g. `gtm.load`, `consent default`)
- Overrides `dataLayer.push` and `ga`/`gtag()` to yield first before calling the browser-native `push` function
- The override makes sure any further override is overridden again
- It yields between every overridden-call. This ensures we have natural yield points between the nested GTM tasks (that call `push` from within a `push`), ensuring tasks are split across multiple frames.
- The real `push` is called last.

#### `history.pushState/replaceState` overrides

- It **calls the underlying native method on the first call right away**, then yields between every override. The first override then does not call the underlying again.
- Overrides the functions to yield first before calling any overrides
- The override makes sure any further override is overridden again
- It yields between every overridden-call

### Yield method

- [`yieldUnlessUrgent`](https://kurtextrem.de/posts/improve-inp#exit-event-handlers-yieldunlessurgent) with only low priority yielding (`setTimeout(fn, 1)` / `postTask({priority:"background"})`) + waits for next paint via a rAF queue to batch
- We only support the low priority yielding here, because we guarantee the listeners run when the user is about to leave
- We check `isInputPending()` to keep yielding if `true`

- We also await the `load` event before waiting for the next paint, unless the yield is as response to a user interaction. This ensures synchronous GTM tasks don't start running before hydration is started (unless the user leaves the page before that).
- We don't wait for `load` in response to user interactions, as we prevent React from handling browser events before that, so the browser should be able to execute other event handlers / native logic.
- For `mousedown` specifically, if it was the left mouse button, we wait for the next `click` event before we yield, as anything running in response to `mousedown` could cause input delay for `click`

### Shortcomings

I only tested this with a React root that is **NOT** attached to the body element. This is an important factor, as it ensures React doesn't create `document` level event listeners.

- `e.preventDefault()`/`e.stopPropagation()`/`e.stopImmediatePropagation()` do nothing in the capture and bubble phase of events, but that seems fine in practice
- It doesn't fight the `hashchange`, `popstate`, `resize`, `scrollend` (scroll depth trigger) listeners.
  - It makes sense to run tasks right after those, as it's unlikely the user clicks _immediately_ after those events.
  - It's not possible to stop propagation for those without patching the GTM source.
- It doesn't fix the `.innerText` call that causes a reflow if you have `individualElementId` listeners. Those might only be fixable by patching the GTM source.
- Making GTM events yield can create subtle, racy differences when navigations are involved. In practice, GTM seems to pick up URL changes correctly though.

## 3p event listener analysis

By using the snippet from the next chapter & DevTools overrides, I've monitored which 3p scripts add which listeners and how:

#### GTM

- GTM adds a listener to `document` right when it loads, with the 3rd param of `addEventListener` set to `false`. This is the listener that also reads `.innerText` to set the `gtm.elementText` data
- Then, for `individualElementIds` GTM adds another listener on `document` with the third param set to `true` (capturing listener)
- It also listens to `hashchange`, `popstate`, `pageshow`
- Overrides `history.pushState` and `history.replaceState`
- Overrides form submits:

```js
var f = HTMLFormElement.prototype.submit;
HTMLFormElement.prototype.submit = function() {
  d(this);
  f.call(this)
}
```

#### Others

- GA adds a `document` listener with the 3rd param set to `false`
- Meta/FB tracker overrides `history.pushState` and `history.replaceState`
- lftracker adds a document listener, with the 3rd param set to `true`
- FB / Meta tracker adds a document listener with the 3rd param set to `{capture: true, once: false, passive: true}`
- No 3p adds a listener to `document.body` itself

## Logging all page listeners

Add the following via DevTools overrides as early as possible to the page (before any 3p scripts are loaded). This way you can see what listeners are added and what events they listen to.

```js
const originalAddEventListener = Element.prototype.addEventListener

// Override the addEventListener method
Element.prototype.addEventListener = function(type, listener, options) {
   console.log(`Adding event listener for event type: ${type}`, listener, options, this);

   // Call the original addEventListener method
   originalAddEventListener.call(this, type, listener, options);
 }


const originalAddEventListener1 = document.addEventListener;
document.addEventListener = function(type, listener, options) {
   console.log(`-- Adding event listener for event type: ${type}`, listener, options);

   // Call the original addEventListener method
   originalAddEventListener1.call(this, type, listener, options);
}
```
