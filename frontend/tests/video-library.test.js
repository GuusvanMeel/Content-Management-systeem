import { describe, expect, it } from 'vitest'
import { filterVideos, libraryView, normalizeForSearch, sortVideos } from '../src/lib/videoLibrary'

const own = { id: 1, name: 'Zwembad A', isOwn: true }
const other = { id: 2, name: 'Café de Kade', isOwn: false }

const video = (id, name, extra = {}) => ({
  id,
  name,
  description: null,
  durationSeconds: 60,
  fileSizeBytes: 1000,
  uploadedAt: '2026-10-20T10:00:00Z',
  owner: own,
  ...extra,
})

const VIDEOS = [
  video(1, 'Diepste punt', { description: 'Onder water', durationSeconds: 300, fileSizeBytes: 5000, uploadedAt: '2026-10-21T10:00:00Z' }),
  video(2, 'Ééndjes in het bad', { owner: other, durationSeconds: 30, fileSizeBytes: 9000, uploadedAt: '2026-10-23T10:00:00Z' }),
  video(3, 'zwemles', { description: 'Les voor beginners', durationSeconds: 120, uploadedAt: '2026-10-22T10:00:00Z' }),
  video(4, 'Badmeester', { owner: other, description: 'Toezicht', durationSeconds: 120, fileSizeBytes: 1000 }),
]
const ids = (list) => list.map((v) => v.id)

describe('normalizeForSearch', () => {
  it('ignores case and accents', () => {
    expect(normalizeForSearch('Café ÉÉN')).toBe('cafe een')
  })
})

describe('filterVideos (FR-023, FR-025)', () => {
  it('searches name, description and owner name, ignoring case and accents', () => {
    expect(ids(filterVideos(VIDEOS, { query: 'beginners' }))).toEqual([3])
    expect(ids(filterVideos(VIDEOS, { query: 'cafe' }))).toEqual([2, 4])
    expect(ids(filterVideos(VIDEOS, { query: 'ZWEMBAD a' }))).toEqual([1, 3])
    expect(ids(filterVideos(VIDEOS, { query: 'eendjes' }))).toEqual([2])
  })

  it('finds part of a word', () => {
    expect(ids(filterVideos(VIDEOS, { query: 'dieps' }))).toEqual([1])
  })

  it('filters on one owning organisation, together with the other filters (FR-025b)', () => {
    expect(ids(filterVideos(VIDEOS, { ownerId: other.id }))).toEqual([2, 4])
    expect(ids(filterVideos(VIDEOS, { ownerId: other.id, query: 'toezicht' }))).toEqual([4])
    expect(ids(filterVideos(VIDEOS, { ownerId: other.id, ownership: 'own' }))).toEqual([])
    expect(ids(filterVideos(VIDEOS, { ownerId: null }))).toEqual([1, 2, 3, 4])
    expect(ids(libraryView(VIDEOS, { ownerId: other.id, sort: 'name-asc' }))).toEqual([4, 2])
  })

  it('filters on own videos and videos of others', () => {
    expect(ids(filterVideos(VIDEOS, { ownership: 'own' }))).toEqual([1, 3])
    expect(ids(filterVideos(VIDEOS, { ownership: 'others' }))).toEqual([2, 4])
    expect(ids(filterVideos(VIDEOS, { ownership: 'all' }))).toEqual([1, 2, 3, 4])
  })
})

describe('sortVideos (FR-024)', () => {
  it('sorts on every field in both directions, then on id', () => {
    expect(ids(sortVideos(VIDEOS, { field: 'uploadedAt', direction: 'desc' }))).toEqual([2, 3, 1, 4])
    expect(ids(sortVideos(VIDEOS, { field: 'uploadedAt', direction: 'asc' }))).toEqual([4, 1, 3, 2])
    expect(ids(sortVideos(VIDEOS, { field: 'name', direction: 'asc' }))).toEqual([4, 1, 2, 3])
    expect(ids(sortVideos(VIDEOS, { field: 'name', direction: 'desc' }))).toEqual([3, 2, 1, 4])
    expect(ids(sortVideos(VIDEOS, { field: 'durationSeconds', direction: 'desc' }))).toEqual([1, 4, 3, 2])
    expect(ids(sortVideos(VIDEOS, { field: 'durationSeconds', direction: 'asc' }))).toEqual([2, 3, 4, 1])
    expect(ids(sortVideos(VIDEOS, { field: 'fileSizeBytes', direction: 'asc' }))).toEqual([3, 4, 1, 2])
  })

  it('does not change the original list', () => {
    const before = ids(VIDEOS)
    sortVideos(VIDEOS, { field: 'name', direction: 'asc' })
    expect(ids(VIDEOS)).toEqual(before)
  })
})

describe('libraryView', () => {
  it('combines search, filter and sort', () => {
    expect(ids(libraryView(VIDEOS, { query: 'b', ownership: 'others', sort: 'name-asc' }))).toEqual([4, 2])
  })

  it('handles 500 videos in well under 50 ms', () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      video(i + 1, `Video ${i}`, { description: `Beschrijving ${i % 37}`, durationSeconds: (i * 7) % 600, owner: i % 3 ? own : other }),
    )
    const start = performance.now()
    const result = libraryView(many, { query: 'beschrijving 1', ownership: 'all', sort: 'name-asc' })
    expect(performance.now() - start).toBeLessThan(50)
    expect(result.length).toBeGreaterThan(0)
  })
})
