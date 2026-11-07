import type { CaptureMetadataV1 } from '../../shared/src/capture';
import type { CommittedScreenshotInput } from '../../server/src/library/repository';

/** Metadata only: no capture files, PNG processing, or import service. */
export function screenshotInput(captureId: string, videoId = 'abcdefghijk'): CommittedScreenshotInput {
  const provenance: CaptureMetadataV1 = {
    schemaVersion: 1, captureId,
    source: { platform: 'youtube', videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}` },
    capture: { playbackSeconds: 42.25, capturedAt: '2026-11-06T12:34:56.789Z', method: 'video-frame-capture' },
    image: { filename: `${captureId}.png`, width: 640, height: 360, format: 'png' },
    editorialExtension: { retained: true },
  };
  return { provenance, originalMetadataJson: JSON.stringify(provenance, null, 2),
    image: { width: 640, height: 360, byteSize: 100, sha256: 'a'.repeat(64) } };
}
