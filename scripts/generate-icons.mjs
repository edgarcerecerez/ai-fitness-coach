import { PNG } from 'pngjs'
import fs from 'fs'
import path from 'path'

const outDir = path.join(process.cwd(), 'public', 'icons')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const sizes = [16, 32, 48, 72, 96, 128, 144, 152, 192, 384, 512]

function createPng(size, color = { r: 25, g: 107, b: 255, a: 255 }) {
  const png = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2
      png.data[idx] = color.r
      png.data[idx + 1] = color.g
      png.data[idx + 2] = color.b
      png.data[idx + 3] = color.a
    }
  }
  return PNG.sync.write(png)
}

for (const size of sizes) {
  const buf = createPng(size)
  const name = size >= 192 ? `icon-${size}x${size}.png` : `favicon-${size}x${size}.png`
  fs.writeFileSync(path.join(outDir, name), buf)
}

// Extra shortcut icons referenced by manifest
const special96 = createPng(96)
fs.writeFileSync(path.join(outDir, 'camera-96x96.png'), special96)
fs.writeFileSync(path.join(outDir, 'meal-96x96.png'), special96)

console.log(`Generated ${sizes.length} placeholder icons in ${outDir}`)

