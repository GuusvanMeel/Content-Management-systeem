import { describe, expect, it } from 'vitest'
import {
  normalizeDescription,
  parseOrganisationIds,
  validateName,
  validateVisibility,
} from '../../src/lib/videoChoices.js'

/** Runs `fn` and returns the `fields` of the validation error it throws. */
function fieldsOf(fn) {
  try {
    fn()
  } catch (err) {
    expect(err.code).toBe('validation_failed')
    return err.fields
  }
  throw new Error('expected a validation error')
}

describe('normalizeDescription (specs/003 research R5)', () => {
  it('treats empty and whitespace-only text as no description', () => {
    expect(normalizeDescription(null)).toBeNull()
    expect(normalizeDescription(undefined)).toBeNull()
    expect(normalizeDescription('')).toBeNull()
    expect(normalizeDescription('   \n  ')).toBeNull()
  })

  it('trims and keeps line breaks as \\n', () => {
    expect(normalizeDescription('  tekst \r\n regel 2 ')).toBe('tekst \n regel 2')
  })

  it('allows 1000 characters, counted as code points', () => {
    expect(normalizeDescription('a'.repeat(1000))).toHaveLength(1000)
    const emoji = '😀'.repeat(1000)
    expect(normalizeDescription(emoji)).toBe(emoji)
  })

  it('refuses 1001 characters', () => {
    expect(fieldsOf(() => normalizeDescription('a'.repeat(1001)))).toEqual({
      description: 'De beschrijving mag maximaal 1000 tekens zijn.',
    })
    expect(fieldsOf(() => normalizeDescription('😀'.repeat(1001))).description).toBeTruthy()
  })
})

describe('validateName', () => {
  it('trims and accepts 1 to 255 characters', () => {
    expect(validateName('  Duikplank  ')).toBe('Duikplank')
    expect(validateName('a'.repeat(255))).toHaveLength(255)
  })

  it('refuses empty and too long names', () => {
    expect(fieldsOf(() => validateName('  '))).toEqual({ name: 'Vul een naam in.' })
    expect(fieldsOf(() => validateName('a'.repeat(256)))).toEqual({ name: 'De naam mag maximaal 255 tekens lang zijn.' })
  })
})

describe('validateVisibility', () => {
  it('accepts the three values only', () => {
    for (const value of ['public', 'selective', 'private']) expect(validateVisibility(value)).toBe(value)
    for (const value of ['onzin', '', null, undefined, 'PUBLIC']) {
      expect(fieldsOf(() => validateVisibility(value))).toEqual({ visibility: 'Kies een beschikbaarheid.' })
    }
  })
})

describe('parseOrganisationIds', () => {
  it('accepts a comma-separated string or an array, without duplicates', () => {
    expect(parseOrganisationIds('4,9')).toEqual([4, 9])
    expect(parseOrganisationIds([4, 9, 4])).toEqual([4, 9])
    expect(parseOrganisationIds(' 4 , 9 ')).toEqual([4, 9])
    expect(parseOrganisationIds('')).toEqual([])
    expect(parseOrganisationIds(undefined)).toEqual([])
  })

  it('refuses values that are not positive whole numbers', () => {
    for (const value of ['4,x', '1.5', '-2', [0], ['abc']]) {
      expect(fieldsOf(() => parseOrganisationIds(value))).toEqual({
        accessOrganisationIds: 'Kies alleen organisaties uit de lijst.',
      })
    }
  })
})
