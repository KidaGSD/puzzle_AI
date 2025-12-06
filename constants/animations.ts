/**
 * Animation Constants
 * Defines micro-animations for grid interactions
 */

export const GRID_ANIMATIONS = {
  // Snap animation when piece lands on grid
  SNAP: {
    duration: 150, // ms
    easing: 'ease-out',
  },

  // Connection pulse when piece connects to center
  CONNECTION_PULSE: {
    duration: 300, // ms
    scale: [1, 1.02, 1],
    glow: true,
  },

  // Shake animation on invalid drop
  INVALID_SHAKE: {
    duration: 200, // ms
    keyframes: [
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(-2px)' },
      { transform: 'translateX(0)' },
    ],
  },

  // Hover lift effect
  HOVER_LIFT: {
    duration: 100, // ms
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },

  // Drag shadow
  DRAG_SHADOW: {
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    scale: 1.05,
  },

  // Spawn animation (piece appearing)
  SPAWN: {
    duration: 200, // ms
    initialScale: 0.8,
    initialOpacity: 0,
    easing: 'ease-out',
  },

  // Delete animation (piece disappearing)
  DELETE: {
    duration: 150, // ms
    scale: 0.9,
    opacity: 0,
    easing: 'ease-in',
  },
};

/**
 * CSS transition string for position changes
 */
export const POSITION_TRANSITION = `transform ${GRID_ANIMATIONS.SNAP.duration}ms ${GRID_ANIMATIONS.SNAP.easing}`;

/**
 * CSS classes for different animation states
 */
export const ANIMATION_CLASSES = {
  // Smooth transitions for grid movements
  snapTransition: 'transition-transform duration-150 ease-out',

  // Hover effect
  hoverLift: 'hover:-translate-y-0.5 hover:shadow-lg transition-all duration-100',

  // Dragging state
  dragging: 'shadow-2xl scale-105',

  // Invalid position
  invalidShake: 'animate-shake',

  // Connection pulse
  connectionPulse: 'animate-pulse-once',

  // Spawn in
  spawnIn: 'animate-spawn-in',

  // Delete out
  deleteOut: 'animate-delete-out',
};

/**
 * Tailwind keyframe definitions (add to tailwind.config.js)
 *
 * animation: {
 *   'shake': 'shake 0.2s ease-in-out',
 *   'pulse-once': 'pulse-once 0.3s ease-out',
 *   'spawn-in': 'spawn-in 0.2s ease-out',
 *   'delete-out': 'delete-out 0.15s ease-in forwards',
 * },
 * keyframes: {
 *   shake: {
 *     '0%, 100%': { transform: 'translateX(0)' },
 *     '25%': { transform: 'translateX(-4px)' },
 *     '75%': { transform: 'translateX(4px)' },
 *   },
 *   'pulse-once': {
 *     '0%, 100%': { transform: 'scale(1)' },
 *     '50%': { transform: 'scale(1.02)' },
 *   },
 *   'spawn-in': {
 *     '0%': { transform: 'scale(0.8)', opacity: '0' },
 *     '100%': { transform: 'scale(1)', opacity: '1' },
 *   },
 *   'delete-out': {
 *     '0%': { transform: 'scale(1)', opacity: '1' },
 *     '100%': { transform: 'scale(0.9)', opacity: '0' },
 *   },
 * }
 */
