import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  captureSelfieFromVideo,
  isCameraSupported,
  openFrontCamera,
  stopCamera,
  type CapturedSelfie,
} from '@/lib/selfieCapture';

/**
 * Circular face frame (v0.12.1): the live camera — or the captured
 * photo — inside a circle, with a hand-built inline SVG ring around
 * it. No image assets, no new dependency, CSS/SVG animation only.
 *
 * The ring is Qovu accent blue (#0071e3), never the green from the
 * Sumsub reference screenshot — one accent only, per the design
 * system. While the camera is live the dashes slowly rotate and a
 * solid arc progressively fills the ring; when the photo is taken
 * the ring is complete. Reduced motion shows a static ring (see
 * globals.css). The ring is decorative (aria-hidden); the video
 * keeps its own label.
 *
 * Geometry (viewBox 0 0 200 200, centre 100,100, r 95): the ring
 * sits a few pixels outside the photo circle, as in the reference.
 * Circumference 2π×95 ≈ 597 — the fill arc draws from a
 * dashoffset of 597 to 0.
 */
function FaceFrame({ mode, children }: { mode: 'idle' | 'live' | 'captured'; children?: ReactNode }) {
  return (
    <div className="relative mx-auto aspect-square w-64 max-w-full">
      <div className="absolute inset-2 rounded-full bg-canvas" aria-hidden="true" />
      {children}
      <svg
        viewBox="0 0 200 200"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* Faint dotted track — always there, so the frame reads even before the camera starts. */}
        <circle
          cx="100"
          cy="100"
          r="95"
          fill="none"
          stroke="#e5e5e5"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="0.1 8"
        />
        {mode === 'live' ? (
          <>
            {/* Slowly rotating accent dashes. */}
            <circle
              cx="100"
              cy="100"
              r="95"
              fill="none"
              stroke="#0071e3"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="16 12"
              className="selfie-ring-spin"
            />
            {/* Solid arc that progressively fills the ring while the camera is live. */}
            <circle
              cx="100"
              cy="100"
              r="95"
              fill="none"
              stroke="#0071e3"
              strokeWidth="3"
              strokeLinecap="round"
              className="selfie-ring-fill"
            />
          </>
        ) : mode === 'captured' ? (
          /* Photo taken: the ring is complete, no motion. */
          <circle
            cx="100"
            cy="100"
            r="95"
            fill="none"
            stroke="#0071e3"
            strokeWidth="3"
            strokeLinecap="round"
            className="selfie-ring-complete"
          />
        ) : (
          /* Before the camera starts: a quiet static accent ring. */
          <circle
            cx="100"
            cy="100"
            r="95"
            fill="none"
            stroke="#0071e3"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="16 12"
            opacity="0.35"
          />
        )}
      </svg>
    </div>
  );
}

/**
 * Compulsory live-selfie step (v0.10.0), shown in the student submit
 * form after the passcode is validated and before the final submit.
 *
 * A live selfie is REQUIRED to submit attendance — there is no way
 * to submit without one. The photo is only used to check the same
 * face is not used twice in this class, and it is deleted after
 * the session. When the camera is missing or denied, the form
 * stops here with a plain message: the student goes to the
 * lecturer, who adds them by hand (manual attendance) — that is
 * the only fallback, and it happens outside this form.
 *
 * The component never submits anything itself: it hands the
 * captured photo to `onDone`, and the parent sends it with the
 * submission. The camera stream is stopped on use and on unmount.
 *
 * Look (v0.12.1, owner request): a clean white card, the camera
 * inside a circular face frame with an animated dashed ring in
 * Qovu blue, short guidance below it — the Sumsub liveness
 * screen's look, Apple-standard premium. Only the presentation
 * changed: the capture, the hash, the compulsory rule and the
 * server enforcement are exactly as before. We do NOT integrate
 * Sumsub or any paid liveness/deepfake service.
 */
export function SelfieStep({ onDone }: { onDone: (selfie: CapturedSelfie) => void }) {
  const [step, setStep] = useState<'intro' | 'camera' | 'preview' | 'error'>('intro');
  const [note, setNote] = useState<string | null>(null);
  const [captured, setCaptured] = useState<CapturedSelfie | null>(null);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => stopCamera(streamRef.current), []);

  useEffect(() => {
    if (step === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [step]);

  function closeCamera() {
    stopCamera(streamRef.current);
    streamRef.current = null;
  }

  async function startCamera() {
    setNote(null);
    if (!isCameraSupported()) {
      setNote(
        'You need a front camera to submit your attendance. If your phone has no front camera, go to your lecturer — they will add you by hand.',
      );
      setStep('error');
      return;
    }
    setStarting(true);
    const stream = await openFrontCamera();
    setStarting(false);
    if (!stream) {
      setNote(
        'You need a front camera to submit your attendance. If your phone has no front camera, go to your lecturer — they will add you by hand.',
      );
      setStep('error');
      return;
    }
    streamRef.current = stream;
    setStep('camera');
  }

  function takePhoto() {
    const selfie = captureSelfieFromVideo(videoRef.current);
    if (!selfie) {
      setNote('Could not take the photo. Try again.');
      return;
    }
    setCaptured(selfie);
    setStep('preview');
  }

  function usePhoto() {
    if (!captured) return;
    closeCamera();
    onDone(captured);
  }

  return (
    <div className="mt-6 flex flex-col items-center rounded-xl border border-line bg-surface p-6 text-center">
      <h2 className="text-[17px] font-semibold text-ink">Take a live selfie</h2>
      <p className="mt-1 self-stretch text-left text-[15px] leading-relaxed text-muted">
        A live selfie is required to submit your attendance. This photo is only used to check
        the same face is not used twice in this class, and it is deleted after the session. If
        your phone has no front camera, go to your lecturer — they will add you by hand.
      </p>

      {step === 'intro' ? (
        <>
          <div className="mt-6 w-full">
            <FaceFrame mode="idle" />
          </div>
          <p className="mt-6 text-[17px] font-semibold text-ink">Look straight into the camera</p>
          <p className="mt-1 text-[15px] text-muted">
            Only one still photo is taken — no video is recorded.
          </p>
          <div className="mt-6 w-full max-w-[280px]">
            <Button
              onClick={() => void startCamera()}
              disabled={starting}
              className="w-full"
            >
              {starting ? 'Starting camera…' : 'Take a live selfie'}
            </Button>
          </div>
        </>
      ) : null}

      {step === 'camera' ? (
        <>
          <div className="mt-6 w-full">
            <FaceFrame mode="live">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                aria-label="Live camera preview"
                className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)] rounded-full bg-ink object-cover"
              />
            </FaceFrame>
          </div>
          <p className="mt-6 text-[17px] font-semibold text-ink">Look straight into the camera</p>
          <p className="mt-1 text-[15px] text-muted">
            Only one still photo is taken — no video is recorded.
          </p>
          <div className="mt-6 w-full max-w-[280px]">
            <Button onClick={takePhoto} className="w-full">
              Take photo
            </Button>
          </div>
        </>
      ) : null}

      {step === 'preview' && captured ? (
        <>
          <div className="mt-6 w-full">
            <FaceFrame mode="captured">
              <img
                src={captured.previewUrl}
                alt="Your selfie preview"
                className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)] rounded-full object-cover"
              />
            </FaceFrame>
          </div>
          <p className="mt-6 text-[17px] font-semibold text-ink">Photo taken</p>
          <p className="mt-1 text-[15px] text-muted">
            Use this photo to submit your attendance, or retake it.
          </p>
          <div className="mt-6 flex w-full max-w-[280px] flex-col gap-3">
            <Button onClick={usePhoto} className="w-full">
              Use this photo
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setCaptured(null);
                setNote(null);
                void startCamera();
              }}
            >
              Retake
            </Button>
          </div>
        </>
      ) : null}

      {step === 'error' ? (
        <div className="mt-6 w-full max-w-[280px]">
          <Button onClick={() => void startCamera()} className="w-full">
            Try the camera again
          </Button>
        </div>
      ) : null}

      {note ? (
        <p className="mt-4 text-[13px] text-danger" role="alert">
          {note}
        </p>
      ) : null}
    </div>
  );
}
