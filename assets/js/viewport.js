// Read the same safe-area tokens used by the content gutters. VisualViewport
// handles browser UI/zoom; safe insets apply to the layout viewport's edges.
export function readSafeViewport() {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const inset = side => Math.max(0, parseFloat(style.getPropertyValue(`--safe-area-${side}`)) || 0);
  const visual = window.visualViewport;
  const left = visual?.offsetLeft ?? 0;
  const top = visual?.offsetTop ?? 0;
  return {
    left: Math.max(left, inset('left')),
    top: Math.max(top, inset('top')),
    right: Math.min(left + (visual?.width ?? root.clientWidth), root.clientWidth - inset('right')),
    bottom: Math.min(top + (visual?.height ?? window.innerHeight), window.innerHeight - inset('bottom')),
  };
}

export function getPopoverArea(frame, viewport, headerBottom = 0, inset = 12) {
  const left = Math.max(frame.left, viewport.left) + inset;
  const right = Math.min(frame.right, viewport.right) - inset;
  const top = Math.max(frame.top, viewport.top, headerBottom) + inset;
  const bottom = Math.min(frame.bottom, viewport.bottom) - inset;
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

export function placePopover(area, anchor, width, naturalHeight, gap = 12) {
  const below = Math.max(0, area.bottom - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - area.top - gap);
  const useBelow = below >= naturalHeight || (above < naturalHeight && below >= above);
  const availableHeight = useBelow ? below : above;
  const maxHeight = Math.min(
    area.height,
    availableHeight < Math.min(naturalHeight, 120) ? area.height : availableHeight
  );
  const height = Math.min(naturalHeight, maxHeight);
  const preferredTop = useBelow ? anchor.bottom + gap : anchor.top - gap - height;
  return {
    left: Math.max(area.left, Math.min(anchor.left + (anchor.width - width) / 2, area.right - width)),
    top: Math.max(area.top, Math.min(preferredTop, area.bottom - height)),
    maxHeight,
  };
}
