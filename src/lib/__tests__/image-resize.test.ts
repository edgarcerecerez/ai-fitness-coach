import { calculateResizedDimensions } from '../image-resize'

describe('calculateResizedDimensions', () => {
  it('returns the same dimensions when both edges are within maxEdge', () => {
    expect(calculateResizedDimensions(1024, 768, 2048)).toEqual({
      width: 1024,
      height: 768,
    })
  })

  it('scales down landscape images so the long edge equals maxEdge', () => {
    const result = calculateResizedDimensions(4000, 3000, 2048)
    expect(result.width).toBe(2048)
    // 3000 * (2048 / 4000) = 1536
    expect(result.height).toBe(1536)
  })

  it('scales down portrait images so the long edge equals maxEdge', () => {
    const result = calculateResizedDimensions(3000, 4000, 2048)
    expect(result.height).toBe(2048)
    expect(result.width).toBe(1536)
  })

  it('scales square images so both edges equal maxEdge', () => {
    expect(calculateResizedDimensions(5000, 5000, 1024)).toEqual({
      width: 1024,
      height: 1024,
    })
  })

  it('rounds resulting dimensions to integers', () => {
    const result = calculateResizedDimensions(1234, 567, 800)
    expect(Number.isInteger(result.width)).toBe(true)
    expect(Number.isInteger(result.height)).toBe(true)
  })

  it('never returns a zero edge for very thin images', () => {
    const result = calculateResizedDimensions(10000, 1, 100)
    expect(result.width).toBe(100)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })

  it('never returns a zero edge for sub-pixel inputs (rounding floor)', () => {
    // Both edges are < 0.5, so naive Math.round would yield 0.
    const result = calculateResizedDimensions(0.4, 0.3, 2048)
    expect(result.width).toBeGreaterThanOrEqual(1)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })

  it('clamps very small fractional dimensions when scaling down', () => {
    // 0.4 * (10 / max(0.4, 0.3)) rounds to 0 without clamp.
    const result = calculateResizedDimensions(0.4, 0.3, 0.1)
    expect(result.width).toBeGreaterThanOrEqual(1)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })

  it('throws when given non-finite dimensions', () => {
    expect(() => calculateResizedDimensions(Number.NaN, 100)).toThrow()
    expect(() => calculateResizedDimensions(100, Number.POSITIVE_INFINITY)).toThrow()
  })

  it('throws when given non-positive dimensions or maxEdge', () => {
    expect(() => calculateResizedDimensions(0, 100)).toThrow()
    expect(() => calculateResizedDimensions(100, -10)).toThrow()
    expect(() => calculateResizedDimensions(100, 100, 0)).toThrow()
  })
})
