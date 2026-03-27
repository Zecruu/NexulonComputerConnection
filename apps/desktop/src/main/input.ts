import { mouse, keyboard, Point, Button, Key } from '@nut-tree-fork/nut-js';
import { screen as electronScreen } from 'electron';
import { z } from 'zod';

// --- Input event schemas ---

export const MouseMoveSchema = z.object({
  type: z.literal('mousemove'),
  x: z.number(),
  y: z.number(),
});

export const MouseClickSchema = z.object({
  type: z.literal('mousedown').or(z.literal('mouseup')),
  x: z.number(),
  y: z.number(),
  button: z.number(), // 0 = left, 1 = middle, 2 = right
});

export const MouseScrollSchema = z.object({
  type: z.literal('scroll'),
  deltaX: z.number(),
  deltaY: z.number(),
});

export const KeyEventSchema = z.object({
  type: z.literal('keydown').or(z.literal('keyup')),
  key: z.string(),
  code: z.string(),
});

export const InputEventSchema = z.discriminatedUnion('type', [
  MouseMoveSchema,
  MouseClickSchema,
  MouseScrollSchema,
  KeyEventSchema,
]);

export type InputEvent = z.infer<typeof InputEventSchema>;

// Map browser button index to nut-js Button
function mapButton(button: number): Button {
  switch (button) {
    case 0:
      return Button.LEFT;
    case 1:
      return Button.MIDDLE;
    case 2:
      return Button.RIGHT;
    default:
      return Button.LEFT;
  }
}

// Map browser key codes to nut-js Key enum
// This covers common keys; extend as needed
const KEY_MAP: Record<string, Key> = {
  KeyA: Key.A, KeyB: Key.B, KeyC: Key.C, KeyD: Key.D,
  KeyE: Key.E, KeyF: Key.F, KeyG: Key.G, KeyH: Key.H,
  KeyI: Key.I, KeyJ: Key.J, KeyK: Key.K, KeyL: Key.L,
  KeyM: Key.M, KeyN: Key.N, KeyO: Key.O, KeyP: Key.P,
  KeyQ: Key.Q, KeyR: Key.R, KeyS: Key.S, KeyT: Key.T,
  KeyU: Key.U, KeyV: Key.V, KeyW: Key.W, KeyX: Key.X,
  KeyY: Key.Y, KeyZ: Key.Z,
  Digit0: Key.Num0, Digit1: Key.Num1, Digit2: Key.Num2,
  Digit3: Key.Num3, Digit4: Key.Num4, Digit5: Key.Num5,
  Digit6: Key.Num6, Digit7: Key.Num7, Digit8: Key.Num8,
  Digit9: Key.Num9,
  Space: Key.Space, Enter: Key.Enter, Escape: Key.Escape,
  Backspace: Key.Backspace, Tab: Key.Tab, Delete: Key.Delete,
  ArrowUp: Key.Up, ArrowDown: Key.Down,
  ArrowLeft: Key.Left, ArrowRight: Key.Right,
  ShiftLeft: Key.LeftShift, ShiftRight: Key.RightShift,
  ControlLeft: Key.LeftControl, ControlRight: Key.RightControl,
  AltLeft: Key.LeftAlt, AltRight: Key.RightAlt,
  MetaLeft: Key.LeftSuper, MetaRight: Key.RightSuper,
  CapsLock: Key.CapsLock,
  F1: Key.F1, F2: Key.F2, F3: Key.F3, F4: Key.F4,
  F5: Key.F5, F6: Key.F6, F7: Key.F7, F8: Key.F8,
  F9: Key.F9, F10: Key.F10, F11: Key.F11, F12: Key.F12,
  Home: Key.Home, End: Key.End,
  PageUp: Key.PageUp, PageDown: Key.PageDown,
  Insert: Key.Insert, PrintScreen: Key.Print,
  Minus: Key.Minus, Equal: Key.Equal,
  BracketLeft: Key.LeftBracket, BracketRight: Key.RightBracket,
  Semicolon: Key.Semicolon, Quote: Key.Quote,
  Backquote: Key.Grave, Backslash: Key.Backslash,
  Comma: Key.Comma, Period: Key.Period, Slash: Key.Slash,
};

function mapKey(code: string): Key | undefined {
  return KEY_MAP[code];
}

// Set to track currently pressed keys (prevent duplicate pressAndHold calls)
const pressedKeys = new Set<string>();

/**
 * Processes an input event from the viewer and simulates it on the host machine.
 * Coordinates are normalized (0-1 range) and mapped to actual screen resolution.
 */
export async function handleInputEvent(event: InputEvent): Promise<void> {
  const primaryDisplay = electronScreen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;

  try {
    switch (event.type) {
      case 'mousemove': {
        const absX = Math.round(event.x * width);
        const absY = Math.round(event.y * height);
        await mouse.setPosition(new Point(absX, absY));
        break;
      }

      case 'mousedown': {
        const absX = Math.round(event.x * width);
        const absY = Math.round(event.y * height);
        await mouse.setPosition(new Point(absX, absY));
        await mouse.pressButton(mapButton(event.button));
        break;
      }

      case 'mouseup': {
        const absX = Math.round(event.x * width);
        const absY = Math.round(event.y * height);
        await mouse.setPosition(new Point(absX, absY));
        await mouse.releaseButton(mapButton(event.button));
        break;
      }

      case 'scroll': {
        // nut-js scrollDown/scrollUp takes amount in "lines"
        const lines = Math.abs(Math.round(event.deltaY / 120));
        if (event.deltaY > 0) {
          await mouse.scrollDown(lines || 1);
        } else if (event.deltaY < 0) {
          await mouse.scrollUp(lines || 1);
        }
        break;
      }

      case 'keydown': {
        const key = mapKey(event.code);
        if (key && !pressedKeys.has(event.code)) {
          pressedKeys.add(event.code);
          await keyboard.pressKey(key);
        }
        break;
      }

      case 'keyup': {
        const key = mapKey(event.code);
        if (key) {
          pressedKeys.delete(event.code);
          await keyboard.releaseKey(key);
        }
        break;
      }
    }
  } catch (err) {
    // Input simulation errors are non-fatal — log and continue
    console.error('[input] Simulation error:', err);
  }
}
