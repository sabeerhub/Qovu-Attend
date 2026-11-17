import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  captureSelfieFromVideo,
  isCameraSupported,
  openFrontCamera,
  stopCamera,
  type CapturedSelfie,
} from '@/lib/selfieCapture';

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
    <div className="mt-6 flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <div>
        <h2 className="text-[15px] font-medium text-ink">Take a live selfie</h2>
        <p className="mt-1 text-[13px] text-muted">
          A live selfie is required to submit your attendance. This photo is only used to check
          the same face is not used twice in this class, and it is deleted after the session. If
          your phone has no front camera, go to your lecturer — they will add you by hand.
        </p>
      </div>

      {step === 'intro' ? (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void startCamera()} disabled={starting}>
            {starting ? 'Opening camera…' : 'Take a live selfie'}
          </Button>
        </div>
      ) : null}

      {step === 'camera' ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Live camera preview"
            className="w-full rounded-lg bg-ink"
          />
          <p className="text-[13px] text-muted">
            Look at the camera and tap Take photo. Only one still photo is taken — no video is
            recorded.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={takePhoto}>Take photo</Button>
          </div>
        </>
      ) : null}

      {step === 'preview' && captured ? (
        <>
          <img
            src={captured.previewUrl}
            alt="Your selfie preview"
            className="w-full rounded-lg"
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={usePhoto}>Use this photo</Button>
            <Button
              variant="secondary"
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
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void startCamera()}>Try the camera again</Button>
        </div>
      ) : null}

      {note ? (
        <p className="text-[13px] text-danger" role="alert">
          {note}
        </p>
      ) : null}
    </div>
  );
}
