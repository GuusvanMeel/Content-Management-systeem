import { AppError } from './errors.js'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])

const invalidLogo = () =>
  new AppError(400, 'invalid_logo', 'Gebruik een PNG-, JPG- of SVG-afbeelding zonder scripts.')

// Anything in an SVG that could run code or load something from elsewhere (research R7).
const UNSAFE_SVG_PATTERNS = [
  /<!DOCTYPE/i,
  /<!ENTITY/i,
  /<script[\s>/]/i,
  /<foreignObject[\s>/]/i,
  /<(iframe|embed|object)[\s>/]/i,
  /\son[a-z]+\s*=/i,
  /\b(xlink:)?href\s*=\s*["']?\s*(https?:|\/\/|data:|javascript:)/i,
  /url\(\s*["']?\s*(https?:|\/\/|data:|javascript:)/i,
  /@import/i,
]

function isSafeSvg(buffer) {
  const text = buffer.toString('utf8')
  // Invalid UTF-8 turns into replacement characters: not a text file.
  if (text.includes('\uFFFD')) return false
  const body = text
    .replace(/^\uFEFF/, '')
    .replace(/<\?xml[\s\S]*?\?>/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
  const hasSvgRoot = /^<svg[\s>]/.test(body) && /<\/svg>$/.test(body)
  return hasSvgRoot && !UNSAFE_SVG_PATTERNS.some((pattern) => pattern.test(body))
}

/** Determines the logo type from the file contents, not its name (FR-025). */
export function detectLogoType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw invalidLogo()
  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return 'png'
  if (buffer.subarray(0, JPG_SIGNATURE.length).equals(JPG_SIGNATURE)) return 'jpg'
  if (isSafeSvg(buffer)) return 'svg'
  throw invalidLogo()
}
