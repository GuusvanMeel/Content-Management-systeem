// Customer-facing rejection messages for videos (specs/002 research R15), therefore in Dutch.
// The same texts as backend/src/lib/videoMessages.js; the numbers come from upload-settings.

const GIB = 1024 ** 3
const number = (value) => new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(value)

export function videoMessage(code, settings = {}) {
  switch (code) {
    case 'video_unsupported_format':
      return 'Dit bestandstype kan niet worden gebruikt. Kies een MP4-video (de bestandsnaam eindigt op .mp4).'
    case 'video_unsupported_codec':
      return 'Deze video is op een manier opgeslagen die de VR-bril niet kan afspelen. Sla de video in je bewerkingsprogramma opnieuw op als MP4 met de instelling ‘H.264’.'
    case 'video_not_360':
      return "Dit is geen 360°-video. Kies een video die met een 360°-camera is gemaakt; zo'n beeld is twee keer zo breed als hoog."
    case 'video_resolution_too_high':
      return `De beeldkwaliteit van deze video is te hoog voor de VR-bril. Sla de video opnieuw op met een lagere resolutie: maximaal ${settings.maxWidth} × ${settings.maxHeight} beeldpunten.`
    case 'video_unreadable':
      return 'Dit bestand kan niet als video worden geopend. Controleer of de video op je computer goed afspeelt en probeer het opnieuw.'
    case 'video_too_large':
      return `Deze video is groter dan ${number(settings.maxFileSizeBytes / GIB)} GB. Maak de video korter of sla hem op in een lagere kwaliteit.`
    case 'insufficient_storage':
      return 'Er is op dit moment niet genoeg opslagruimte. Neem contact op met de beheerder.'
    default:
      throw new Error(`Unknown video message code: ${code}`)
  }
}
