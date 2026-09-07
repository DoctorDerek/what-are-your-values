declare global {
  interface Window {
    getVisibleTextBounds: (
      text: Element,
    ) => Pick<DOMRect, "left" | "right" | "top" | "bottom">
  }
}

export function installVisibleTextBounds(): void {
  window.getVisibleTextBounds = (text) => {
    let { left, right, top, bottom } = text.getBoundingClientRect()
    for (
      let ancestor = text.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      const style = getComputedStyle(ancestor)
      const clip = ancestor.getBoundingClientRect()
      if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)) {
        left = Math.max(left, clip.left)
        right = Math.min(right, clip.right)
      }
      if (["auto", "scroll", "hidden", "clip"].includes(style.overflowY)) {
        top = Math.max(top, clip.top)
        bottom = Math.min(bottom, clip.bottom)
      }
    }
    return { left, right, top, bottom }
  }
}
