export interface DisplayOriginInput { uiOrigin: string; manualOrigin?: string; refresh?: boolean }
export type DisplayOriginSource = 'detected' | 'manual' | 'current';
export type DisplayOriginObservation =
  | { ready: true; origin: string; source: DisplayOriginSource; message: string }
  | { ready: false; origin: string | null; source: DisplayOriginSource | null; code: 'DETECTION_UNAVAILABLE' | 'ORIGIN_NOT_ALLOWED' | 'LISTENER_LOCAL_ONLY'; message: string };
