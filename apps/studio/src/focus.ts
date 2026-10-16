/**
 * Focus on an element that a render is about to draw: `find` is asked once
 * now and then once a frame, and the first element it gives takes focus.
 * React draws an edit before the next frame and zoneless Angular within a
 * frame or two; `frames` bounds the wait, so an element that never comes
 * leaves focus where it was rather than leaving a loop running.
 */
export function focusWhenDrawn(find: () => HTMLElement | null, frames = 30): void {
  const attempt = (left: number): void => {
    const found = find()
    if (found !== null) {
      found.focus()
      return
    }
    if (left > 0) requestAnimationFrame(() => attempt(left - 1))
  }
  attempt(frames)
}
