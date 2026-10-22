# Testvideo's

Kleine testbestanden (1–2 s, elk < 200 KB) voor de backendtests van feature 002
(`specs/002-video-library/research.md`, R12). Ze worden gemaakt met
[`make-fixtures.sh`](make-fixtures.sh); zonder lokale ffmpeg:

```bash
docker run --rm -v "$PWD:/work" -w /work alpine:3 sh -c "apk add --no-cache ffmpeg && sh make-fixtures.sh"
```

| Bestand | Inhoud | Verwacht |
| --- | --- | --- |
| `valid-512x256.mp4` | H.264, 2:1, met AAC-geluid | geaccepteerd |
| `valid-silent-1024x512.mp4` | H.264, 2:1, zonder geluid | geaccepteerd |
| `valid-opus-audio-512x256.mp4` | H.264, 2:1, Opus-geluid | geaccepteerd (FR-002a) |
| `valid-4096x2048.mp4` | H.264, precies de maximale resolutie | geaccepteerd |
| `not-360-640x360.mp4` | H.264, 16:9 | `video_not_360` |
| `square-1024x1024.mp4` | H.264, 1:1 (3D boven-onder) | `video_not_360` |
| `too-large-4352x2176.mp4` | H.264, 2:1, boven 4096×2048 | `video_resolution_too_high` |
| `h265-512x256.mp4` | H.265 in MP4 | `video_unsupported_codec` |
| `quicktime-512x256.mp4` | H.264 in MOV-container met `.mp4`-naam | `video_unsupported_format` |
| `audio-only.mp4` | alleen geluid | `video_unreadable` |
| `corrupt.mp4` | willekeurige bytes | `video_unreadable` |
| `clip.mov` | H.264, 2:1, `.mov`-extensie | `415` bij aanmaken (extensie) |
