/** Producer metadata is preserved as JSON; runtime capture validation belongs to import. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue | undefined };

export interface CaptureMetadataV1 {
  schemaVersion: 1;
  captureId: string;
  source: {
    platform: 'youtube';
    videoId: string;
    canonicalUrl: string;
    title?: string;
    [key: string]: JsonValue | undefined;
  };
  capture: {
    playbackSeconds: number;
    capturedAt: string;
    method: 'video-frame-capture';
    [key: string]: JsonValue | undefined;
  };
  image: {
    filename: string;
    width: number;
    height: number;
    format: 'png';
    [key: string]: JsonValue | undefined;
  };
  [key: string]: JsonValue | undefined;
}
