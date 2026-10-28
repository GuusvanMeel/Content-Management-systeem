export function uniqueName(prefix = 'E2E') {
  return `${prefix}-${Date.now()}`;
}
