import { describe, expect, it } from 'vitest'
import { confirmationText, countLosingAccess } from '../src/lib/videoAccess'

const ALL = [4, 9, 12, 15] // four other active organisations
const value = (visibility, accessOrganisationIds = []) => ({ visibility, accessOrganisationIds })

describe('countLosingAccess (FR-017a)', () => {
  it('counts the organisations that lose access', () => {
    expect(countLosingAccess(value('public'), value('selective', [4]), ALL)).toBe(3)
    expect(countLosingAccess(value('public'), value('private'), ALL)).toBe(4)
    expect(countLosingAccess(value('selective', [4, 9]), value('selective', [4]), ALL)).toBe(1)
    expect(countLosingAccess(value('selective', [4, 9]), value('private'), ALL)).toBe(2)
  })

  it('is zero when access stays the same or widens', () => {
    expect(countLosingAccess(value('selective', [4]), value('public'), ALL)).toBe(0)
    expect(countLosingAccess(value('private'), value('public'), ALL)).toBe(0)
    expect(countLosingAccess(value('private'), value('selective', [9]), ALL)).toBe(0)
    expect(countLosingAccess(value('selective', [4]), value('selective', [4, 9]), ALL)).toBe(0)
  })
})

describe('confirmationText', () => {
  it('uses singular and plural', () => {
    expect(confirmationText(1)).toBe('1 organisatie kan deze video daarna niet meer zien.')
    expect(confirmationText(3)).toBe('3 organisaties kunnen deze video daarna niet meer zien.')
  })
})
