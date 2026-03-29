/**
 * iPadOS-style morphing cursor overlay.
 *
 * Feature flag: enabled by GameSettings.ipadCursor (default true).
 * Kill switch: call ipadCursorDisable() or set settings.ipadCursor = false and reload.
 *
 * Rendered as a white div with mix-blend-mode: difference so it
 * visually inverts whatever is beneath it without needing colour knowledge.
 *
 * Does NOT interfere with touch input, focus management, or Phaser's input system.
 */

const IDLE_SIZE = 12; // px diameter in resting state
const HOVER_PAD = 10; // px padding added around the hovered element's bounds
const DUR = '0.22s';
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const TRANSITION = [
  `width ${DUR} ${EASE}`,
  `height ${DUR} ${EASE}`,
  `border-radius ${DUR} ${EASE}`,
  `left ${DUR} ${EASE}`,
  `top ${DUR} ${EASE}`,
].join(', ');

export type CSSRect = { left: number; top: number; width: number; height: number };

let el: HTMLDivElement | null = null;
let styleEl: HTMLStyleElement | null = null;
let mx = -200;
let my = -200;
let isHovering = false;
let exitTimer: ReturnType<typeof setTimeout> | null = null;
let prevRect: CSSRect | null = null;

function onMouseMove(e: MouseEvent): void {
  mx = e.clientX;
  my = e.clientY;
  if (!isHovering && el) {
    el.style.transition = 'none';
    el.style.left = `${mx}px`;
    el.style.top = `${my}px`;
  }
}

/** Enable the iPadOS cursor overlay. Idempotent — safe to call multiple times. */
export function ipadCursorEnable(): void {
  if (el) return;

  // Suppress native cursor across the whole page while the overlay is active.
  styleEl = document.createElement('style');
  styleEl.textContent =
    'html, body, canvas, button, a, input, select, [tabindex] { cursor: none !important; }';
  document.head.appendChild(styleEl);

  el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    zIndex: '999999',
    pointerEvents: 'none',
    width: `${IDLE_SIZE}px`,
    height: `${IDLE_SIZE}px`,
    borderRadius: '50%',
    background: '#ffffff',
    mixBlendMode: 'difference',
    left: `${mx}px`,
    top: `${my}px`,
    transform: 'translate(-50%, -50%)',
    transition: 'none',
    willChange: 'width, height, left, top',
  });
  document.body.appendChild(el);

  document.addEventListener('mousemove', onMouseMove, { passive: true });
}

/** Remove the overlay and restore default cursors. */
export function ipadCursorDisable(): void {
  if (!el) return;
  document.removeEventListener('mousemove', onMouseMove);
  if (exitTimer) clearTimeout(exitTimer);
  el.remove();
  el = null;
  styleEl?.remove();
  styleEl = null;
  isHovering = false;
  prevRect = null;
  exitTimer = null;
}

/**
 * Called every Phaser frame from CustomCursor.update().
 *
 * Pass the CSS-pixel bounding rect of the currently-hovered interactive element,
 * or null when the pointer is not over anything interactive.
 */
export function ipadCursorSetHover(rect: CSSRect | null): void {
  if (!el) return;

  // Skip DOM writes when nothing has changed.
  if (rect === null && prevRect === null) return;
  if (rect !== null && prevRect !== null) {
    const same =
      Math.abs(rect.left - prevRect.left) < 0.5 &&
      Math.abs(rect.top - prevRect.top) < 0.5 &&
      Math.abs(rect.width - prevRect.width) < 0.5 &&
      Math.abs(rect.height - prevRect.height) < 0.5;
    if (same) return;
  }

  prevRect = rect ? { ...rect } : null;

  if (rect) {
    if (exitTimer) {
      clearTimeout(exitTimer);
      exitTimer = null;
    }
    isHovering = true;

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const w = rect.width + HOVER_PAD * 2;
    const h = rect.height + HOVER_PAD * 2;
    // Pill radius: half the shorter dimension for a natural hug shape.
    const r = Math.min(w, h) / 2;

    el.style.transition = TRANSITION;
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.borderRadius = `${r}px`;
  } else if (isHovering) {
    isHovering = false;

    el.style.transition = TRANSITION;
    el.style.left = `${mx}px`;
    el.style.top = `${my}px`;
    el.style.width = `${IDLE_SIZE}px`;
    el.style.height = `${IDLE_SIZE}px`;
    el.style.borderRadius = '50%';

    // After the exit transition, remove the transition so mouse-tracking is instantaneous.
    exitTimer = setTimeout(() => {
      exitTimer = null;
      if (!isHovering && el) {
        el.style.transition = 'none';
      }
    }, 280);
  }
}
