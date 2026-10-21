import { describe, expect, it } from 'vitest'
import { detectLogoType } from '../../src/lib/logoValidation.js'
import { PNG_BYTES, JPG_BYTES } from '../helpers/images.js'

const svg = (inner, attrs = '') =>
  Buffer.from(`<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`)

const rejects = (buffer) => {
  expect(() => detectLogoType(buffer)).toThrow(expect.objectContaining({ code: 'invalid_logo' }))
}

describe('logo validation (FR-025, research R7)', () => {
  it('detects PNG and JPG by their contents', () => {
    expect(detectLogoType(PNG_BYTES)).toBe('png')
    expect(detectLogoType(JPG_BYTES)).toBe('jpg')
  })

  it('rejects a text file named .png and an empty file', () => {
    rejects(Buffer.from('this is not an image'))
    rejects(Buffer.alloc(0))
  })

  it('accepts a plain SVG', () => {
    expect(detectLogoType(svg('<rect width="10" height="10" fill="#0055A4"/>', 'viewBox="0 0 10 10"'))).toBe('svg')
  })

  it.each([
    ['a script', svg('<script>alert(1)</script>')],
    ['an event handler', svg('<rect width="1" height="1"/>', 'onload="alert(1)"')],
    ['an external href', svg('<image href="https://example.com/x.png"/>')],
    ['an external xlink:href', svg('<use xlink:href="//example.com/x.svg#a"/>')],
    ['a data URI', svg('<image href="data:image/png;base64,AAAA"/>')],
    ['foreignObject', svg('<foreignObject><div>x</div></foreignObject>')],
    ['a DOCTYPE with entities', Buffer.from('<!DOCTYPE svg [<!ENTITY x "y">]><svg>&x;</svg>')],
    ['another root element', Buffer.from('<html><svg></svg></html>')],
  ])('rejects an SVG with %s', (_name, buffer) => {
    rejects(buffer)
  })
})
