/**
 * Mobile-friendly client-side image resizing helpers.
 *
 * Provides a pure size-calculation utility (testable in Node) plus a
 * browser-only resize that draws the source image onto a canvas at the
 * computed dimensions and returns a JPEG `Blob`.
 */

export interface ResizeOptions {
  /** Maximum length of the longest edge, in pixels. */
  maxEdge?: number
  /** JPEG quality in the [0, 1] range. */
  quality?: number
  /** Output MIME type. Only `image/jpeg` and `image/webp` are recommended. */
  mimeType?: string
}

export interface ResizedImageDimensions {
  width: number
  height: number
}

const DEFAULTS: Required<Omit<ResizeOptions, 'mimeType'>> & {
  mimeType: string
} = {
  maxEdge: 2048,
  quality: 0.85,
  mimeType: 'image/jpeg',
}

/**
 * Pure helper that scales `(width, height)` so neither edge exceeds `maxEdge`,
 * preserving aspect ratio. Inputs that are already smaller are returned
 * unchanged. Output dimensions are rounded to whole pixels and never zero.
 */
export function calculateResizedDimensions(
  width: number,
  height: number,
  maxEdge: number = DEFAULTS.maxEdge
): ResizedImageDimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('Width and height must be finite numbers.')
  }
  if (width <= 0 || height <= 0) {
    throw new Error('Width and height must be positive.')
  }
  if (!Number.isFinite(maxEdge) || maxEdge <= 0) {
    throw new Error('maxEdge must be a positive number.')
  }

  const longest = Math.max(width, height)
  if (longest <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) }
  }

  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Resizes an image blob in the browser. Returns the original blob unchanged
 * if both dimensions are already within `maxEdge`. Throws in non-browser
 * environments because it relies on `HTMLImageElement` and `HTMLCanvasElement`.
 */
export async function resizeImageBlob(
  source: Blob,
  options: ResizeOptions = {}
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('resizeImageBlob can only be used in the browser.')
  }

  const { maxEdge, quality, mimeType } = { ...DEFAULTS, ...options }
  const objectUrl = URL.createObjectURL(source)

  try {
    const image = await loadImage(objectUrl)
    const dims = calculateResizedDimensions(
      image.naturalWidth,
      image.naturalHeight,
      maxEdge
    )

    if (dims.width === image.naturalWidth && dims.height === image.naturalHeight) {
      return source
    }

    const canvas = document.createElement('canvas')
    canvas.width = dims.width
    canvas.height = dims.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Unable to get 2D canvas context.')
    }
    ctx.drawImage(image, 0, 0, dims.width, dims.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to encode resized image.'))
        },
        mimeType,
        quality
      )
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load source image.'))
    img.src = src
  })
}
