#!/bin/sh
# Generates the small test videos used by the backend tests (specs/002 research R12).
# Requires ffmpeg with libx264, libx265 and libopus. Without a local ffmpeg, run it in Docker:
#   docker run --rm -v "$PWD:/work" -w /work alpine:3 sh -c "apk add --no-cache ffmpeg && sh make-fixtures.sh"
# Every file is 1-2 seconds of synthetic test pattern at low quality, so each stays small.
set -eu
cd "$(dirname "$0")"

FF="ffmpeg -hide_banner -loglevel error -y"
PATTERN="testsrc=duration=2:rate=10"
X264="-c:v libx264 -preset ultrafast -crf 40 -pix_fmt yuv420p"

# Valid: H.264, 2:1, with AAC audio
$FF -f lavfi -i "$PATTERN:size=512x256" -f lavfi -i "sine=duration=2" -shortest \
  $X264 -c:a aac -b:a 32k -movflags +faststart valid-512x256.mp4

# Valid: H.264, 2:1, no audio
$FF -f lavfi -i "$PATTERN:size=1024x512" $X264 -movflags +faststart valid-silent-1024x512.mp4

# Valid: H.264, 2:1, Opus audio (audio is not checked, FR-002a)
$FF -f lavfi -i "$PATTERN:size=512x256" -f lavfi -i "sine=duration=2" -shortest \
  $X264 -c:a libopus -b:a 24k -movflags +faststart valid-opus-audio-512x256.mp4

# Valid: H.264 at exactly the default maximum resolution 5760x2880 (FR-003a), 1 frame per second
$FF -f lavfi -i "testsrc=duration=2:rate=1:size=5760x2880" $X264 -movflags +faststart valid-max-5760x2880.mp4

# Not 360°: 16:9 and 1:1 (3D top-bottom is not supported)
$FF -f lavfi -i "$PATTERN:size=640x360" $X264 not-360-640x360.mp4
$FF -f lavfi -i "$PATTERN:size=1024x1024" $X264 square-1024x1024.mp4

# Twice as wide as high, but above 5760x2880
$FF -f lavfi -i "testsrc=duration=2:rate=1:size=6144x3072" $X264 too-large-6144x3072.mp4

# H.265 in an MP4 container
$FF -f lavfi -i "$PATTERN:size=512x256" -c:v libx265 -preset ultrafast -crf 40 -tag:v hvc1 \
  -x265-params log-level=error h265-512x256.mp4

# H.264 in a QuickTime (MOV) container, named .mp4 (major brand "qt  ")
$FF -f lavfi -i "$PATTERN:size=512x256" $X264 -f mov quicktime-512x256.mp4

# Audio only
$FF -f lavfi -i "sine=duration=2" -c:a aac -b:a 32k audio-only.mp4

# Random bytes with an .mp4 name
head -c 2048 /dev/urandom > corrupt.mp4

# Valid content but a .mov extension (rejected before the upload starts)
$FF -f lavfi -i "$PATTERN:size=512x256" $X264 -f mov clip.mov

ls -l
