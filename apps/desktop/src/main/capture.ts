import { desktopCapturer, screen } from 'electron';

export interface CaptureSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
}

/**
 * Lists available screen sources for capture.
 * Returns source IDs that can be passed to getUserMedia in the renderer.
 */
export async function getCaptureSources(): Promise<CaptureSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 320, height: 180 },
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnailDataUrl: source.thumbnail.toDataURL(),
  }));
}

/**
 * Returns the primary display's resolution for coordinate mapping.
 */
export function getScreenSize(): { width: number; height: number } {
  const primaryDisplay = screen.getPrimaryDisplay();
  return primaryDisplay.size;
}

/**
 * Quality presets mapping to getUserMedia video constraints.
 * Applied in the renderer when calling getUserMedia with the source ID.
 */
export const QUALITY_PRESETS = {
  low: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 15, max: 20 },
  },
  medium: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 24, max: 30 },
  },
  high: {
    width: { ideal: 2560 },
    height: { ideal: 1440 },
    frameRate: { ideal: 30, max: 60 },
  },
} as const;

export type QualityPreset = keyof typeof QUALITY_PRESETS;
