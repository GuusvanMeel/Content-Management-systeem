import crypto from 'node:crypto'

// 3–50 characters, A-Z, 0-9 and '-', not starting or ending with '-' (data-model.md, research R6).
const LOGIN_CODE_PATTERN = /^[A-Z0-9](?:[A-Z0-9-]{1,48})[A-Z0-9]$/
const SUGGESTION_MAX_LENGTH = 46
// Crockford base32 alphabet: no I, L, O or U, and never a '-', so it cannot look like a login code suffix.
export const QUEST_LINK_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const QUEST_LINK_LENGTH = 8

/** Trims and upper-cases, which makes every comparison case-insensitive (FR-005). */
export function normalizeLoginCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

export function isValidLoginCode(code) {
  return LOGIN_CODE_PATTERN.test(code)
}

/** "Zwembad De Hoven" → "ZWEMBAD-DE-HOVEN" (FR-004a). May return an empty or too short string. */
export function suggestLoginCodeBase(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SUGGESTION_MAX_LENGTH)
    .replace(/-+$/, '')
}

export function generateQuestLinkCode() {
  let code = ''
  for (let i = 0; i < QUEST_LINK_LENGTH; i++) {
    code += QUEST_LINK_ALPHABET[crypto.randomInt(QUEST_LINK_ALPHABET.length)]
  }
  return code
}
