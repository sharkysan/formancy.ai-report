/**
 * The window's width, as a test sets it: what resizing a browser window
 * does that a media query hears -- `innerWidth`, then `resize` -- for the
 * matchMedia stand-in test-setup.ts gives jsdom. jsdom lays nothing out,
 * so nothing else follows the width; what a width looks like is the
 * browser gate's.
 */

/** jsdom's own window width, which every test starts at. */
export const JSDOM_WIDTH = 1024

export function setWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}
