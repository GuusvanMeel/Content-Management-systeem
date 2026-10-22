import { describe, expect, it } from 'vitest'
import { videoMessage } from '../src/lib/videoMessages'

// The texts of specs/002 research R15 (identical to the backend), with the default limits.
const SETTINGS = { maxFileSizeBytes: 10 * 1024 ** 3, maxWidth: 5760, maxHeight: 2880 }
const R15 = {
  video_unsupported_format: 'Dit bestandstype kan niet worden gebruikt. Kies een MP4-video (de bestandsnaam eindigt op .mp4).',
  video_unsupported_codec: 'Deze video is op een manier opgeslagen die de VR-bril niet kan afspelen. Sla de video in je bewerkingsprogramma opnieuw op als MP4 met de instelling ‘H.264’.',
  video_not_360: "Dit is geen 360°-video. Kies een video die met een 360°-camera is gemaakt; zo'n beeld is twee keer zo breed als hoog.",
  video_resolution_too_high: 'De beeldkwaliteit van deze video is te hoog voor de VR-bril. Sla de video opnieuw op met een lagere resolutie: maximaal 5760 × 2880 beeldpunten.',
  video_unreadable: 'Dit bestand kan niet als video worden geopend. Controleer of de video op je computer goed afspeelt en probeer het opnieuw.',
  video_too_large: 'Deze video is groter dan 10 GB. Maak de video korter of sla hem op in een lagere kwaliteit.',
  insufficient_storage: 'Er is op dit moment niet genoeg opslagruimte. Neem contact op met de beheerder.',
}

describe('videoMessage (frontend)', () => {
  it.each(Object.entries(R15))('%s matches research R15', (code, text) => {
    expect(videoMessage(code, SETTINGS)).toBe(text)
  })

  it('uses no technical wording such as "2:1" or "pixels"', () => {
    for (const code of Object.keys(R15)) expect(videoMessage(code, SETTINGS)).not.toMatch(/2:1|pixels|codec/i)
  })
})
