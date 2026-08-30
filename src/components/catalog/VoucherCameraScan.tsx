import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserCodeReader, BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';

type DetectionOutcome = 'added' | 'duplicate' | 'ignored';

type Props = {
  onDetected: (text: string) => DetectionOutcome;
  active?: boolean;
  scanCount?: number;
};

const DECODE_EMIT_DEBOUNCE_MS = 800;
// Chrome/Windows sometimes reports a just-released webcam as busy for a brief moment
// (NotReadableError/TrackStartError) when the page re-mounts the scanner quickly after
// leaving and returning. Retry a couple of times with a short delay before surfacing an error.
const CAMERA_BUSY_RETRY_DELAYS_MS = [400, 900];

function playTone(frequency: number, durationSec: number, onEnd?: () => void) {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    oscillator.start();
    oscillator.stop(ctx.currentTime + durationSec);
    oscillator.onended = () => {
      void ctx.close();
      onEnd?.();
    };
  } catch {
    onEnd?.();
  }
}

function playBeep() {
  playTone(880, 0.12);
}

function playDuplicateBeep() {
  playTone(440, 0.08, () => {
    window.setTimeout(() => playTone(440, 0.08), 80);
  });
}

function buildVideoConstraints(deviceId?: string, useFacingMode = true): MediaStreamConstraints {
  const advanced = [{ focusMode: 'continuous' }] as MediaTrackConstraintSet[];
  if (deviceId) {
    return {
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        advanced,
      },
    };
  }
  if (useFacingMode) {
    return {
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        advanced,
      },
    };
  }
  return { video: true };
}

function pickDefaultDeviceIndex(devices: MediaDeviceInfo[]): number {
  const backIdx = devices.findIndex((d) => /back|rear|environment/i.test(d.label));
  if (backIdx >= 0) return backIdx;
  return devices.length > 1 ? devices.length - 1 : 0;
}

function isTransientCameraBusyError(err: unknown): boolean {
  const name = err instanceof DOMException ? err.name : '';
  return name === 'NotReadableError' || name === 'TrackStartError';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Izin kamera ditolak. Aktifkan akses kamera di pengaturan browser, atau gunakan tab Input Manual.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Kamera tidak ditemukan di perangkat ini. Gunakan tab Input Manual.';
  }
  if (isTransientCameraBusyError(err)) {
    return 'Kamera sedang dipakai aplikasi lain atau baru saja dilepas. Tutup aplikasi lain yang memakai kamera lalu coba lagi, atau gunakan tab Input Manual.';
  }
  return 'Tidak bisa mengakses kamera. Gunakan tab Input Manual.';
}

export function VoucherCameraScan({ onDetected, active = true, scanCount = 0 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onDetectedRef = useRef(onDetected);
  const defaultDeviceSetRef = useRef(false);
  const lastDecodeEmitRef = useRef<{ text: string; at: number } | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [starting, setStarting] = useState(false);
  const [manuallyOff, setManuallyOff] = useState(false);

  onDetectedRef.current = onDetected;

  const effectiveActive = active && !manuallyOff;

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (video) {
      BrowserCodeReader.cleanVideoSource(video);
    }
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  useEffect(() => {
    if (!effectiveActive) {
      stopCamera();
      return;
    }

    let cancelled = false;
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 300,
      delayBetweenScanSuccess: 800,
    });

    const emitDetection = (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      const now = Date.now();
      if (
        lastDecodeEmitRef.current?.text === text &&
        now - lastDecodeEmitRef.current.at < DECODE_EMIT_DEBOUNCE_MS
      ) {
        return;
      }

      lastDecodeEmitRef.current = { text, at: now };
      const outcome = onDetectedRef.current(text);
      if (outcome === 'added') {
        playBeep();
      } else if (outcome === 'duplicate') {
        playDuplicateBeep();
      }
    };

    const start = async () => {
      setStarting(true);
      setCameraError(null);
      try {
        const videoInputs = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;

        setDevices(videoInputs);

        let selectedIndex = deviceIndex;
        if (!defaultDeviceSetRef.current && videoInputs.length > 0) {
          selectedIndex = pickDefaultDeviceIndex(videoInputs);
          defaultDeviceSetRef.current = true;
          if (selectedIndex !== deviceIndex) {
            setDeviceIndex(selectedIndex);
            return;
          }
        }

        const deviceId = videoInputs[selectedIndex]?.deviceId;
        const videoEl = videoRef.current;
        if (!videoEl) return;

        const tryDecode = async (useFacingMode: boolean) => {
          const constraints = buildVideoConstraints(deviceId, useFacingMode);
          return reader.decodeFromConstraints(constraints, videoEl, (result) => {
            if (result) {
              emitDetection(result.getText());
            }
          });
        };

        const decodeWithFallback = async (): Promise<IScannerControls> => {
          try {
            return await tryDecode(!deviceId);
          } catch (firstErr) {
            if (!deviceId) {
              return await tryDecode(false);
            }
            throw firstErr;
          }
        };

        let controls: IScannerControls | null = null;
        let lastErr: unknown = null;
        for (let attempt = 0; attempt <= CAMERA_BUSY_RETRY_DELAYS_MS.length; attempt += 1) {
          try {
            controls = await decodeWithFallback();
            break;
          } catch (err) {
            lastErr = err;
            const isLastAttempt = attempt === CAMERA_BUSY_RETRY_DELAYS_MS.length;
            if (cancelled || !isTransientCameraBusyError(err) || isLastAttempt) {
              throw err;
            }
            await wait(CAMERA_BUSY_RETRY_DELAYS_MS[attempt]);
            if (cancelled) throw err;
          }
        }
        if (!controls) throw lastErr;

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        const stream = videoEl.srcObject as MediaStream | null;
        const hasTorch = stream ? BrowserCodeReader.mediaStreamIsTorchCompatible(stream) : false;
        setTorchAvailable(hasTorch && typeof controls.switchTorch === 'function');
      } catch (err) {
        if (!cancelled) {
          setCameraError(cameraErrorMessage(err));
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [effectiveActive, deviceIndex, stopCamera]);

  const flipCamera = () => {
    if (devices.length <= 1) return;
    setDeviceIndex((prev) => (prev + 1) % devices.length);
  };

  const toggleTorch = async () => {
    const controls = controlsRef.current;
    if (!controls?.switchTorch) return;
    try {
      const next = !torchOn;
      await controls.switchTorch(next);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
      setTorchOn(false);
    }
  };

  const showFlip = devices.length > 1;

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes vcs-corner-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes vcs-scan-beam {
          0%, 100% { top: 18%; opacity: 0.35; }
          50% { top: 72%; opacity: 0.95; }
        }
        @keyframes vcs-live-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
        .vcs-corner-bracket {
          animation: vcs-corner-pulse 2.4s ease-in-out infinite;
          filter: drop-shadow(0 0 6px var(--color-primary-400));
        }
        .vcs-corner-bracket-delay-1 { animation-delay: 0.3s; }
        .vcs-corner-bracket-delay-2 { animation-delay: 0.6s; }
        .vcs-corner-bracket-delay-3 { animation-delay: 0.9s; }
        .vcs-scan-beam {
          animation: vcs-scan-beam 2.5s ease-in-out infinite;
        }
        .vcs-live-dot {
          animation: vcs-live-blink 1.2s ease-in-out infinite;
        }
      `}</style>

      <div
        className="relative overflow-hidden rounded-[26px] aspect-[3/4] max-h-[420px] mx-auto w-full"
        style={{
          background:
            'radial-gradient(ellipse at 50% 32%, color-mix(in srgb, var(--color-primary-400) 32%, transparent), transparent 58%), linear-gradient(165deg, var(--color-primary-900) 0%, #061510 48%, #030a08 100%)',
          boxShadow: 'inset 0 0 90px 24px rgba(0,0,0,.55)',
        }}
      >
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover ${
            cameraError || manuallyOff ? 'opacity-0' : 'opacity-100'
          }`}
          muted
          playsInline
          autoPlay
        />

        {!cameraError && !manuallyOff && (
          <>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-[14%] left-[12%] right-[12%] bottom-[22%]">
                <span className="vcs-corner-bracket absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-primary-400 rounded-tl-md" />
                <span className="vcs-corner-bracket vcs-corner-bracket-delay-1 absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-primary-400 rounded-tr-md" />
                <span className="vcs-corner-bracket vcs-corner-bracket-delay-2 absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-primary-400 rounded-bl-md" />
                <span className="vcs-corner-bracket vcs-corner-bracket-delay-3 absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-primary-400 rounded-br-md" />
                <div
                  className="vcs-scan-beam absolute left-[8%] right-[8%] h-[3px] rounded-full pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, var(--color-primary-400), var(--color-primary-300), var(--color-primary-400), transparent)',
                    boxShadow: '0 0 18px 4px color-mix(in srgb, var(--color-primary-400) 65%, transparent)',
                    filter: 'blur(0.5px)',
                  }}
                />
              </div>
            </div>

            <div
              className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold text-white/90"
              style={{
                background: 'rgba(255,255,255,.12)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,.18)',
              }}
            >
              <span className="vcs-live-dot w-1.5 h-1.5 rounded-full bg-red-500" />
              LIVE
            </div>

            <div
              className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold text-white"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700))',
                border: '1px solid rgba(255,255,255,.15)',
              }}
            >
              {scanCount} SN
            </div>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
              {showFlip && (
                <button
                  type="button"
                  onClick={flipCamera}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white/90 transition hover:bg-white/10"
                  style={{
                    background: 'rgba(255,255,255,.12)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,.18)',
                  }}
                  aria-label="Ganti kamera"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M11 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
                    <path d="M13 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
                    <path d="m15 9-3 3 3 3M9 9l3 3-3 3" />
                  </svg>
                </button>
              )}
              {torchAvailable && (
                <button
                  type="button"
                  onClick={() => void toggleTorch()}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition hover:bg-white/10 ${
                    torchOn ? 'text-primary-300' : 'text-white/90'
                  }`}
                  style={{
                    background: torchOn ? 'rgba(31,168,122,.35)' : 'rgba(255,255,255,.12)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,.18)',
                  }}
                  aria-label={torchOn ? 'Matikan lampu' : 'Nyalakan lampu'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M9 18h6M10 22h4M12 2v1M4.22 4.22l.7.7M1 12h1M4.22 19.78l.7-.7M12 21v1M19.78 19.78l-.7-.7M23 12h-1M19.78 4.22l-.7.7" />
                    <path d="M12 6a4 4 0 0 0-2 4.5c0 1.2.8 2.2 2 2.7 1.2-.5 2-1.5 2-2.7A4 4 0 0 0 12 6Z" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setManuallyOff(true)}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white/90 transition hover:bg-white/10"
                style={{
                  background: 'rgba(255,255,255,.12)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,.18)',
                }}
                aria-label="Matikan kamera"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M12 2v10" />
                  <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
                </svg>
              </button>
            </div>

            <p className="absolute bottom-14 left-0 right-0 text-center text-[11px] font-semibold text-white/70 px-4 pointer-events-none">
              Arahkan kamera ke barcode / QR voucher
            </p>
          </>
        )}

        {(cameraError || (starting && active && !manuallyOff)) && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div
              className="max-w-xs rounded-2xl px-4 py-3 text-xs font-semibold text-white/90 leading-relaxed"
              style={{
                background: 'rgba(255,255,255,.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,.15)',
              }}
            >
              {cameraError || 'Menyiapkan kamera…'}
            </div>
          </div>
        )}

        {manuallyOff && active && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setManuallyOff(false)}
                className="w-14 h-14 rounded-full flex items-center justify-center text-white transition hover:bg-white/10"
                style={{
                  background: 'rgba(31,168,122,.35)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(59,201,148,.5)',
                }}
                aria-label="Nyalakan kamera"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                  <path d="M12 2v10" />
                  <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
                </svg>
              </button>
              <p className="text-xs font-semibold text-white/80">Kamera dimatikan. Ketuk untuk menyalakan.</p>
            </div>
          </div>
        )}

        {!active && !cameraError && !starting && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div
              className="max-w-xs rounded-2xl px-4 py-3 text-xs font-semibold text-white/90 leading-relaxed"
              style={{
                background: 'rgba(255,255,255,.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,.15)',
              }}
            >
              Batch penuh. Hapus SN atau reset untuk melanjutkan scan kamera.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
