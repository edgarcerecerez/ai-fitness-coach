'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FlipVertical, X, Zap, ZapOff } from 'lucide-react'
import { CameraUtils } from '@/utils/camera-utils'
import { CameraError } from '@/lib/nutrition-types'
import { resizeImageBlob } from '@/lib/image-resize'

interface MobileCameraCaptureProps {
  onCapture: (imageBlob: Blob) => void
  onCancel: () => void
  className?: string
}

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }
type TorchTrack = MediaStreamTrack & {
  getCapabilities?: () => TorchCapabilities
}

/**
 * Mobile-optimized camera capture UI: full-viewport preview, large shutter
 * button, front/back camera switch, optional torch toggle, and haptic
 * feedback on capture. Captured frames are resized client-side
 * (max edge 2048px, JPEG q=0.85) before the blob is handed to `onCapture`.
 */
export default function MobileCameraCapture({
  onCapture,
  onCancel,
  className,
}: MobileCameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<CameraError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment'
  )
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [capturing, setCapturing] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestStreamRef = useRef<MediaStream | null>(null)

  // Keep the cleanup effect from capturing a stale `stream` value.
  useEffect(() => {
    latestStreamRef.current = stream
  }, [stream])

  const initializeCamera = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const permissionResult = await CameraUtils.requestCameraPermission()
    if (!permissionResult.granted) {
      setError(permissionResult.error!)
      setIsLoading(false)
      return
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode,
        },
        audio: false,
      })

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }

      const [track] = mediaStream.getVideoTracks()
      const capabilities: TorchCapabilities =
        (track as TorchTrack).getCapabilities?.() ?? {}
      setTorchSupported(Boolean(capabilities.torch))
      setTorchOn(false)
    } catch (err) {
      console.error('Camera initialization failed:', err)
      setError({ type: 'unknown', message: 'Failed to initialize camera' })
    } finally {
      setIsLoading(false)
    }
  }, [facingMode])

  useEffect(() => {
    initializeCamera()
    return () => {
      const current = latestStreamRef.current
      if (current) CameraUtils.stopCameraStream(current)
    }
  }, [initializeCamera])

  const toggleTorch = async () => {
    if (!stream || !torchSupported) return
    const [track] = stream.getVideoTracks()
    const next = !torchOn
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      })
      setTorchOn(next)
    } catch (err) {
      console.warn('Torch toggle failed:', err)
    }
  }

  const toggleCamera = () => {
    if (stream) CameraUtils.stopCameraStream(stream)
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current || capturing) return

    setCapturing(true)
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not supported')

      // Guard: if metadata isn't ready yet, video dimensions are 0 and
      // drawImage would produce a blank/invalid frame.
      const HAVE_CURRENT_DATA = 2
      if (
        video.readyState < HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        // Wait briefly for the next loaded frame, then retry once.
        await new Promise<void>((resolve) => {
          let timeoutId: ReturnType<typeof setTimeout> | null = null
          const onReady = () => {
            if (timeoutId !== null) clearTimeout(timeoutId)
            video.removeEventListener('loadeddata', onReady)
            resolve()
          }
          video.addEventListener('loadeddata', onReady, { once: true })
          timeoutId = setTimeout(onReady, 500)
        })
        if (
          video.videoWidth === 0 ||
          video.videoHeight === 0 ||
          video.readyState < HAVE_CURRENT_DATA
        ) {
          throw new Error('Camera not ready yet. Please try again.')
        }
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(30)
        } catch {
          // ignore vibrate failures
        }
      }

      const rawBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Capture failed'))),
          'image/jpeg',
          0.95
        )
      })

      const optimized = await resizeImageBlob(rawBlob, {
        maxEdge: 2048,
        quality: 0.85,
        mimeType: 'image/jpeg',
      })
      onCapture(optimized)
    } catch (err) {
      console.error('Capture failed:', err)
      setError({
        type: 'unknown',
        message: 'Failed to capture image. Please try again.',
      })
    } finally {
      setCapturing(false)
    }
  }

  if (error) {
    return (
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-6 ${className ?? ''}`}
      >
        <Alert>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <div className="mt-4 flex gap-2">
          <Button onClick={initializeCamera} variant="outline">
            Try Again
          </Button>
          <Button onClick={onCancel} variant="ghost" className="text-white">
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-black ${className ?? ''}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close camera"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center text-white">
              <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
              <p className="text-sm">Starting camera...</p>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div
        className="flex items-center justify-around bg-black/80 px-6 py-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <button
          type="button"
          onClick={toggleTorch}
          disabled={!torchSupported || isLoading}
          aria-label={torchOn ? 'Turn torch off' : 'Turn torch on'}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-30"
        >
          {torchOn ? (
            <Zap className="h-6 w-6" />
          ) : (
            <ZapOff className="h-6 w-6" />
          )}
        </button>

        <button
          type="button"
          onClick={captureImage}
          disabled={isLoading || capturing}
          aria-label="Capture photo"
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/95 transition-transform active:scale-95 disabled:opacity-50"
          style={{ minWidth: 64, minHeight: 64 }}
        >
          <span className="block h-16 w-16 rounded-full bg-white" />
        </button>

        <button
          type="button"
          onClick={toggleCamera}
          disabled={isLoading}
          aria-label="Switch camera"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-30"
        >
          <FlipVertical className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
