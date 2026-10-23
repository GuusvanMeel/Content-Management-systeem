// Text length in Unicode code points, the way the server counts (specs/003 research R5). The
// browser's maxlength counts UTF-16 units, so an emoji would count as two; we never use it for limits.

export function characterCount(text) {
  return [...(text ?? '')].length
}

/** The text cut to at most `max` code points. */
export function limitCharacters(text, max) {
  const characters = [...(text ?? '')]
  return characters.length > max ? characters.slice(0, max).join('') : text ?? ''
}
