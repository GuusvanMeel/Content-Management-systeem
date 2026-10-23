import { describe, expect, it } from 'vitest'
import { characterCount, limitCharacters } from '../src/lib/textLength'

describe('textLength (specs/003 research R5)', () => {
  it('counts code points, so an emoji counts as one', () => {
    expect(characterCount('abc')).toBe(3)
    expect(characterCount('😀')).toBe(1)
    expect(characterCount('')).toBe(0)
    expect(characterCount(null)).toBe(0)
  })

  it('cuts to the maximum without splitting an emoji', () => {
    const text = '😀'.repeat(600) + 'a'.repeat(600)
    const limited = limitCharacters(text, 1000)
    expect(characterCount(limited)).toBe(1000)
    expect(limited.startsWith('😀'.repeat(600))).toBe(true)
    expect(limitCharacters('kort', 1000)).toBe('kort')
  })
})
