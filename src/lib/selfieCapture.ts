/**
 * Live-selfie capture (v0.10.0).
 *
 * The face check is NOT face recognition: there are no student
 * photos on file, so nothing can prove a face belongs to a
 * registration number. All a selfie does is let the server catch
 * the SAME face being used for two different numbers in one
 * session — a deterrent. A live selfie is compulsory for
 * self-submission: every function here fails soft (returns null)
 * when the camera is missing or denied, and the caller then
 * stops the form with a plain message — the student goes to the
 * lecturer, who adds them by hand. A missing camera never
 * submits without a photo.
 *
 * Capture: the front camera (`facingMode: 'user'`), one still
 * frame, downscaled to a small JPEG (max 480 px wide, quality
 * 0.7). The 8x8 average hash (see `selfieHash.ts`) is computed
 * from the same frame's pixels, never from the JPEG bytes, so the
 * same face hashes the same however the photo was compressed.
 * Only the JPEG bytes and the 16-hex-char hash ever leave the
 * phone — and only when the student sends them with the
 * submission, which the server requires.
 */

import { averageHash } from './selfieHash';

export interface CapturedSelfie {
  /** JPEG bytes, base64 (no data-URL prefix). */
  jpegBase64: string;
  /** 16-hex-char average hash of the frame. */
  hash: string;
  /** Full data URL for the on-screen preview. */
  previewUrl: string;
}

/** True when this browser can open a camera at all. */
export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/**
 * Open the front camera. Returns null (never throws) when the
 * camera is missing, denied, or otherwise unavailable — the caller
 * then stops the form with a plain message and never submits
 * without a photo.
 */
export async function openFrontCamera(): Promise<MediaStream | null> {
  if (!isCameraSupported()) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
  } catch {
    return null;
  }
}

/** Stop every track of a camera stream opened by `openFrontCamera`. */
export function stopCamera(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

/**
 * Capture one still frame from a playing video element: a small
 * JPEG plus its average hash. Returns null when the frame cannot
 * be read (no video yet, no canvas) or when the frame is uniform
 * (covered camera, blank wall) — a uniform frame carries no face
 * information, and its hash would falsely match every other
 * uniform frame.
 */
export function captureSelfieFromVideo(
  video: HTMLVideoElement | null,
): CapturedSelfie | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
  if (typeof document === 'undefined') return null;
  const photoCanvas = document.createElement('canvas');
  const scale = Math.min(1, 480 / video.videoWidth);
  photoCanvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  photoCanvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const photoCtx = photoCanvas.getContext('2d');
  if (!photoCtx || typeof photoCanvas.toDataURL !== 'function') return null;
  photoCtx.drawImage(video, 0, 0, photoCanvas.width, photoCanvas.height);
  const previewUrl = photoCanvas.toDataURL('image/jpeg', 0.7);
  const base64 = previewUrl.split(',', 2)[1] ?? '';
  if (!base64) return null;

  // Hash from the same frame, downscaled to 8x8.
  const hashCanvas = document.createElement('canvas');
  hashCanvas.width = 8;
  hashCanvas.height = 8;
  const hashCtx = hashCanvas.getContext('2d');
  if (!hashCtx) return null;
  hashCtx.drawImage(video, 0, 0, 8, 8);
  const imageData = hashCtx.getImageData(0, 0, 8, 8);
  const hash = averageHash({
    width: 8,
    height: 8,
    data: imageData.data,
  });
  if (!hash) return null;
  return { jpegBase64: base64, hash, previewUrl };
}
