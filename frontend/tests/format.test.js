import { describe, expect, it } from 'vitest'
import { formatDate, formatDurationHms, formatGb, formatSize } from '../src/lib/format'

describe('format', () => {
  it.each([
    [3221225472, '3,0 GB'],
    [1610612736, '1,5 GB'],
    [10737418240, '10,0 GB'],
    [52428800, '50,0 MB'],
    [1048576 * 1.25, '1,3 MB'],
  ])('formatSize(%d) = %s', (bytes, expected) => {
    expect(formatSize(bytes)).toBe(expected)
  })

  it.each([
    [95, '00:01:35'],
    [0, '00:00:00'],
    [3723, '01:02:03'],
  ])('formatDurationHms(%d) = %s', (seconds, expected) => {
    expect(formatDurationHms(seconds)).toBe(expected)
  })

  it('formats a date as dd-mm-jjjj in local time', () => {
    const date = new Date(2026, 9, 22, 11, 14)
    expect(formatDate(date.toISOString())).toBe('22-10-2026')
  })

  it('formats the size limit in whole GB', () => {
    expect(formatGb(10737418240)).toBe('10')
  })
})
