# yieldGTMCalls

_(Last reviewed in the browser August 2025)_

GTM, GA and random other 3p scripts add listeners that run when a user e.g. clicks somewhere. This is bad for INP.

To fix this, we intercept these listeners and yield them before they run.

## How it works

When the inline script executes:
- for `click`, `auxclick`, `mousedown`, `keyup` and `submit`, installs a `document` level `addEventListener` override that intercepts added listeners if it's likely they from from a 3p (-> based on the 3rd argument passed to the fn, as GTM and other 3p's use capturing event listeners for document level ones)

This means, the script **must** execute before any 3rd-party scripts execute.

On `readystatechange === 'interactive'`:
- For the same events as mentioned above, installs a `document.body` level interceptor
- This is done on `interactive` so that it executes right before `DOMContentLoaded`, to ensure our event handler is added first (as first added = first executed)
- GTM etc. add their `document.body` listener at DCL

Explainer for what we achieve with the `document`/`document.body` listeners:
- The `document` one overrides capturing listeners - by overrding `document.addEventListener` to yield before calling the listener (so interception at event registration time)
- The `document.body` one overrides the non-capturing listeners - by stopping propagation at `body` (before it reaches `document`), and then re-dispatches the `event` (cloned)

On `framer:overrideGTM` event:
- Overrides `dataLayer.push` and `ga`/`gtag()` to yield first before calling the real function
- The override makes sure any further override is overridden again
- It yields between every overridden-call. The real `push` is called last

`framer:overrideGTM` is called right after setting up `window.dataLayer`.

`history.pushState/replaceState` overrides:
- Overrides the functions to yield first before calling any overrides
- The override makes sure any further override is overridden again
- It calls the underlying native method on the first call right away, then yields between every override. The first override then does not call the underlying again
- It yields between every overridden-call

Yield method:
- `yieldUnlessUrgent` modified from Philip Walton, with only low priority yielding (`setTimeout(fn, 1)`) (added `pagehide` for Safari support) + waits for next paint via a rAF queue
- We also await the `load` event before waiting for the next paint, unless the yield is as response to a user interaction. This ensures synchronous GTM tasks don't start running before hydration is started (unless the user leaves the page before that).
- We don't wait for `load` in response to user interactions, as we prevent React from handling browser events before that, so the browser should be able to execute other event handlers / native logic.
- For `mousedown` specifically, if it was the left mouse button, we wait for the next `click` event before we yield, as anything running in response to `mousedown` could cause input delay for `click`
- We only support the low priority yielding here, because we guarantee the listeners run when the user is about to leave
- **Important**: This only works for Framer based sites, because React attaches event listeners to our React root. On other pages, defering click calls with `setTimeout(fn, 1)` might introduce delays after a user clicks somewhere

### Shortcomings
- It doesn't fight the `hashchange`, `popstate`, `HTMLFormElement.prototype.submit` override (see next chapter) and also not the `.innerText` call that causes a reflow if you have individualElementId listeners. Those might only be fixable by patching the GTM source.
- I only tested this with a React root that is **NOT** attached to the body element (this is important, as it ensures we don't intercept Reacts event listeners - else we pretty much yield before doing anything, defeating the metrics purpose)
- Making GTM events yield can create subtle, racy differences when navigations are involved. Consider the following example: A user triggers a SPA navigation that causes a dataLayer push. In this case, the URL at the time the push is executed, might no longer reflect the URL where the user clicked on.

## GTM event listener analysis

By using the snippet from the next chapter & DevTools overrides, I've monitored which 3p scripts add which listeners and how:
- GTM adds a listener to `document` right when it loads, with the 3rd param of `addEventListener` set to `false` <-- this is the listener that also does `.innerText` to set the `gtm.elementText` data
- Then, for "individualElementIds" GTM adds another listener on `document` with the third param set to `true` (this is the capturing listener)
- It also listens to `hashchange`, `popstate`, `pageshow`
- FB & GTM override `history.pushState` and `history.replaceState`
- lftracker (some random 3p thing) adds to `document` too, with the 3rd param set to `true`
- GA adds a `document` listener with the 3rd param set to `false`
- FB / Meta tracker adds a document listener with the 3rd param set to `{capture: true, once: false, passive: true}`
- No 3p adds a listener to `document.body` itself

GTM also does this when it loads:
```js
var f = HTMLFormElement.prototype.submit;
HTMLFormElement.prototype.submit = function() {
  d(this);
  f.call(this)
}
```

### Logging all page listeners

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
