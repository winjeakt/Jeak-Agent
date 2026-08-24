// 生成 Windows 多尺寸 .ico（蓝紫渐变 + 白色 Jeak），源图取自 src/main/icon.ts
import { deflateSync, inflateSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'src/main/icon.ts'), 'utf8')
const m = src.match(/const ICON_BASE64 =\s*\n?\s*'([A-Za-z0-9+/=]+)'/)
if (!m) throw new Error('未找到 ICON_BASE64')
const base64 = m[1].replace(/\s+/g, '')

// ---------- PNG 解码 ----------
const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function decodePNG(data) {
  let w = 0, h = 0, colorType = 0
  let idat = []
  let p = 8
  while (p < data.length) {
    const len = data.readUInt32BE(p)
    const type = data.toString('ascii', p + 4, p + 8)
    const body = data.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); colorType = body[9] }
    else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    p += 12 + len
  }
  const bpp = colorType === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const out = Buffer.alloc(w * h * bpp)
  const paeth = (a, b, c) => {
    const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const row = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= bpp ? prev[x - bpp] : 0
      let v = row[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) v += paeth(a, b, c)
      out[y * stride + x] = v & 0xff
    }
  }
  return { w, h, bpp, data: out }
}

// ---------- PNG 编码 ----------
function encodePNG(w, h, bpp, px) {
  const stride = w * bpp
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0
    px.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  const chunk = (type, body) => {
    const t = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length)
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, body])))
    return Buffer.concat([len, t, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = bpp === 4 ? 6 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
  ])
}

// ---------- 双线性缩放 ----------
function resize(src, sw, sh, bpp, dw, dh) {
  const out = Buffer.alloc(dw * dh * bpp)
  const rx = sw / dw, ry = sh / dh
  for (let dy = 0; dy < dh; dy++) {
    const sy = (dy + 0.5) * ry - 0.5
    const y0 = Math.floor(sy), fy = sy - y0
    for (let dx = 0; dx < dw; dx++) {
      const sx = (dx + 0.5) * rx - 0.5
      const x0 = Math.floor(sx), fx = sx - x0
      for (let c = 0; c < bpp; c++) {
        let acc = 0
        for (let oy = 0; oy < 2; oy++) {
          const yy = Math.max(0, Math.min(sh - 1, y0 + oy))
          for (let ox = 0; ox < 2; ox++) {
            const xx = Math.max(0, Math.min(sw - 1, x0 + ox))
            const wgt = (ox ? fx : 1 - fx) * (oy ? fy : 1 - fy)
            acc += src[(yy * sw + xx) * bpp + c] * wgt
          }
        }
        out[(dy * dw + dx) * bpp + c] = Math.round(acc)
      }
    }
  }
  return out
}

// ---------- 编码为传统 BMP-in-ICO 图像（兼容性最好） ----------
function encodeBMP(s, rgba) {
  const maskStride = Math.ceil(s / 32) * 4
  const maskSize = maskStride * s
  const pxSize = s * s * 4
  const body = Buffer.alloc(40 + pxSize + maskSize)
  body.writeUInt32LE(40, 0) // biSize
  body.writeInt32LE(s, 4) // biWidth
  body.writeInt32LE(s * 2, 8) // biHeight（含 AND mask）
  body.writeUInt16LE(1, 12) // biPlanes
  body.writeUInt16LE(32, 14) // biBitCount
  body.writeUInt32LE(0, 16) // biCompression
  body.writeUInt32LE(pxSize + maskSize, 20) // biSizeImage
  // 像素：BGRA、自底向上
  for (let y = 0; y < s; y++) {
    const srcRow = (s - 1 - y) * s * 4
    const dstRow = 40 + y * s * 4
    for (let x = 0; x < s; x++) {
      const si = srcRow + x * 4, di = dstRow + x * 4
      body[di] = rgba[si + 2] // B
      body[di + 1] = rgba[si + 1] // G
      body[di + 2] = rgba[si] // R
      body[di + 3] = rgba[si + 3] // A
    }
  }
  // AND mask 全 0（32 位 alpha 已定义透明度）
  return body
}

// ---------- 组装 ICO ----------
function buildICO(sizes) {
  const imgs = sizes.map((s) => encodeBMP(s, resized[s]))
  const count = sizes.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4)
  let offset = 6 + count * 16
  const entries = []
  sizes.forEach((s, i) => {
    const e = Buffer.alloc(16)
    e[0] = s >= 256 ? 0 : s
    e[1] = s >= 256 ? 0 : s
    e[2] = 0; e[3] = 0
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6)
    e.writeUInt32LE(imgs[i].length, 8)
    e.writeUInt32LE(offset, 12)
    offset += imgs[i].length
    entries.push(e)
  })
  return Buffer.concat([header, ...entries, ...imgs])
}

// ---------- 执行 ----------
const { w, h, bpp, data } = decodePNG(Buffer.from(base64, 'base64'))
const SIZES = [16, 24, 32, 48, 64, 128, 256]
const resized = {}
for (const s of SIZES) resized[s] = resize(data, w, h, bpp, s, s)

const outDir = join(root, 'build')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'icon.ico'), buildICO(SIZES))
writeFileSync(join(outDir, 'icon.png'), encodePNG(256, 256, 4, resized[256]))
console.log('已生成 build/icon.ico 与 build/icon.png（尺寸:', SIZES.join(', '), '）')

// 自检：确认文字为白色、背景为蓝紫渐变
const p = resized[256]
const at = (x, y) => { const i = (y * 256 + x) * 4; return `rgba(${p[i]},${p[i + 1]},${p[i + 2]},${p[i + 3]})` }
let white = 0
for (let i = 0; i < 256 * 256; i++) {
  const r = p[i * 4], g = p[i * 4 + 1], b = p[i * 4 + 2], a = p[i * 4 + 3]
  if (a > 128 && r > 200 && g > 200 && b > 200) white++
}
console.log('自检 center=', at(128, 128), ' topLeft=', at(12, 12), ' bottomRight=', at(244, 244), ' whitePx=', white)
