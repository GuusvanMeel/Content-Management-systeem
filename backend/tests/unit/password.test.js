import { describe, expect, it } from 'vitest'
import { hashPassword, validatePassword, verifyPassword } from '../../src/lib/password.js'

describe('passwords (FR-013, research R5)', () => {
  it('accepts 10 to 128 characters', () => {
    expect(() => validatePassword('a'.repeat(9))).toThrow()
    expect(() => validatePassword('a'.repeat(129))).toThrow()
    expect(() => validatePassword('a'.repeat(10))).not.toThrow()
    expect(() => validatePassword('a'.repeat(128))).not.toThrow()
  })

  it('hashes with argon2id and verifies', async () => {
    const hash = await hashPassword('correct horse battery')
    expect(hash.startsWith('$argon2id$')).toBe(true)
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true)
    expect(await verifyPassword(hash, 'wrong password!!')).toBe(false)
  })
})
