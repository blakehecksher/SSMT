import Phaser from 'phaser';
import { COLORS } from '../constants';
import { getSettings } from '../systems/SettingsSystem';
import { ipadCursorEnable, ipadCursorDisable, ipadCursorSetHover, type CSSRect } from './IPadCursor';

export const SHOW_CIRCLE = true;

const COLOR_IDLE = 0xffffff;
const CURSOR_ALPHA = 0.4;

// Triangle: ~66% of player's triR (player triR = VISUAL_SIZE * 1.3 = 10.4)
const TRI_RADIUS = 7;

// Outer reticle circle
const CIRCLE_RADIUS = 14;

// Crosshair tick marks: extend inward through circle and outward beyond it
const TICK_INNER = 4;  // px inside the circle toward center
const TICK_OUTER = 6;  // px outside the circle

// Radians to leave as a gap on each side of a tick where the circle is broken
const ARC_GAP = 0.28;

/**
 * Convert a Phaser game object's bounding box to CSS viewport pixel coordinates
 * so the iPadOS overlay can morph to wrap it.
 *
 * Handles both scrollFactor=0 (UI/fixed) and scrollFactor=1 (world-space) objects.
 */
function objectToCSSRect(obj: Phaser.GameObjects.GameObject, scene: Phaser.Scene): CSSRect | null {
  if (!('getBounds' in obj)) return null;

  const bounds = (obj as unknown as { getBounds(): Phaser.Geom.Rectangle }).getBounds();
  const canvas = scene.sys.game.canvas;
  const cr = canvas.getBoundingClientRect();
  // Scale between Phaser's internal game pixels and CSS pixels.
  const sx = cr.width / canvas.width;
  const sy = cr.height / canvas.height;

  const sfX: number = (obj as unknown as { scrollFactorX?: number }).scrollFactorX ?? 1;
  const sfY: number = (obj as unknown as { scrollFactorY?: number }).scrollFactorY ?? 1;

  let bx = bounds.x;
  let by = bounds.y;
  let zoomX = 1;
  let zoomY = 1;

  if (sfX !== 0 || sfY !== 0) {
    // World-space object: apply camera scroll and zoom to get screen-space coords.
    const cam = scene.cameras.main;
    bx = (bounds.x - cam.worldView.x) * cam.zoom;
    by = (bounds.y - cam.worldView.y) * cam.zoom;
    zoomX = cam.zoom;
    zoomY = cam.zoom;
  }

  return {
    left: cr.left + bx * sx,
    top: cr.top + by * sy,
    width: bounds.width * zoomX * sx,
    height: bounds.height * zoomY * sy,
  };
}

export class CustomCursor {
  private graphic: Phaser.GameObjects.Graphics;
  private heading = -Math.PI / 2; // default: pointing up
  private active: boolean;
  private hovering = false;
  private styleEl: HTMLStyleElement | null = null;

  constructor(scene: Phaser.Scene) {
    this.active = !scene.sys.game.device.input.touch;

    this.graphic = scene.add
      .graphics()
      .setDepth(9999)
      .setScrollFactor(0);

    if (this.active) {
      // CSS !important overrides Phaser's useHandCursor writing
      // canvas.style.cursor = 'pointer' on interactive hover
      this.styleEl = document.createElement('style');
      this.styleEl.textContent = 'canvas { cursor: none !important; }';
      document.head.appendChild(this.styleEl);

      if (getSettings().ipadCursor) {
        ipadCursorEnable();
      }
    }
  }

  /**
   * Call every frame. Pass player world coordinates in GameScene;
   * omit them in MenuScene to keep the default up-pointing heading.
   */
  update(scene: Phaser.Scene, playerX?: number, playerY?: number): void {
    if (!this.active) return;

    const pointer = scene.input.activePointer;

    if (playerX !== undefined && playerY !== undefined) {
      const dx = pointer.worldX - playerX;
      const dy = pointer.worldY - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 8) {
        this.heading = Math.atan2(dy, dx);
      }
    } else {
      // No player context (menu, pause, results) — ease back to pointing up
      const DEFAULT_HEADING = -Math.PI / 2;
      const diff = DEFAULT_HEADING - this.heading;
      // Normalize to [-PI, PI] so it takes the short way around
      const wrapped = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += wrapped * 0.12;
    }

    // Check if pointer is over any interactive object
    const hits = scene.input.hitTestPointer(pointer);
    this.hovering = hits.length > 0;

    // Drive the iPadOS overlay cursor
    if (getSettings().ipadCursor) {
      const hoverRect = this.hovering
        ? objectToCSSRect(hits[0] as Phaser.GameObjects.GameObject, scene)
        : null;
      ipadCursorSetHover(hoverRect);
    }

    this.graphic.setPosition(pointer.x, pointer.y);
    this.draw();
  }

  private draw(): void {
    const g = this.graphic;
    g.clear();

    const color = this.hovering ? COLORS.PLAYER : COLOR_IDLE;
    const alpha = this.hovering ? CURSOR_ALPHA + 0.3 : CURSOR_ALPHA;

    g.lineStyle(1, color, alpha);

    if (SHOW_CIRCLE) {
      // Broken circle: 4 arcs with gaps at each tick position
      for (let i = 0; i < 4; i++) {
        const startAngle = i * (Math.PI / 2) + ARC_GAP;
        const endAngle = (i + 1) * (Math.PI / 2) - ARC_GAP;
        g.beginPath();
        g.arc(0, 0, CIRCLE_RADIUS, startAngle, endAngle, false);
        g.strokePath();
      }
    }

    // Tick marks — always shown, cross through the circle boundary
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      g.beginPath();
      g.moveTo(cos * (CIRCLE_RADIUS - TICK_INNER), sin * (CIRCLE_RADIUS - TICK_INNER));
      g.lineTo(cos * (CIRCLE_RADIUS + TICK_OUTER), sin * (CIRCLE_RADIUS + TICK_OUTER));
      g.strokePath();
    }

    // Triangle pointing in direction of travel
    const h = this.heading;
    const r = TRI_RADIUS;
    const x1 = Math.cos(h) * r;
    const y1 = Math.sin(h) * r;
    const x2 = Math.cos(h + (Math.PI * 2) / 3) * r;
    const y2 = Math.sin(h + (Math.PI * 2) / 3) * r;
    const x3 = Math.cos(h - (Math.PI * 2) / 3) * r;
    const y3 = Math.sin(h - (Math.PI * 2) / 3) * r;

    g.lineStyle(1.5, color, alpha * 0.9);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.lineTo(x3, y3);
    g.closePath();
    g.strokePath();
  }

  destroy(_scene: Phaser.Scene): void {
    ipadCursorSetHover(null);
    ipadCursorDisable();
    this.styleEl?.remove();
    this.graphic.destroy();
  }
}
