#!/usr/bin/env bash
#
# tools/plates.sh: turn a high-resolution painting into a Buki plate.
#
# WHY THIS EXISTS. The first generation of plates carried a halftone dot screen baked in
# at 1400px. A regular grid cannot be rescaled: fit it to a retina hero and the dots beat
# against the pixel grid into moire, and no re-encode recovers it because the detail was
# never there. The plates on the landing are now duotoned from 4000px museum scans with
# NO screen baked in, and the print tooth is applied in CSS as random grain, which has no
# period and therefore cannot alias.
#
# HOW THE COLOUR WORKS. Cobalt does not come from lifting the blue channel; that only
# desaturates the darks toward periwinkle. It comes from SPREADING the channels: blue
# leads through the shadows and midtones, then red and green overtake it above about 0.75
# so the highlights land on warm cream instead of a cold blue-white. colorlevels runs
# LAST so it has the final word on what ink and cream are. Reversing those two steps is
# the bug that turns the plate lavender.
#
# SOURCES must be public domain. The two in use are Wikimedia Commons scans:
#   hero  Michele Marieschi, Capriccio with Ruins and an Antique Arch      4896x3264
#   band  Giovanni Paolo Panini, An Architectural Capriccio of the Roman Forum  4501x3255
# Crop the gilt frame off before anything else or it duotones into a bright border.
#
# USAGE
#   tools/plates.sh SOURCE OUT.webp CROP WIDTH [TONE]
#     CROP  ffmpeg crop geometry, w:h:x:y, applied to the source before scaling
#     TONE  optional curves control points on the greyscale, before the split
#
# WHAT SHIPPED
#   ./tools/plates.sh marieschi.jpg   docs/arch-2800.webp  4210:2325:343:295 2800
#   ./tools/plates.sh marieschi.jpg   docs/arch-1400.webp  4210:2325:343:295 1400
#   ./tools/plates.sh panini-forum.jpg docs/forum-2200.webp 4050:1558:225:900 2200
#   ./tools/plates.sh panini-forum.jpg docs/forum-1300.webp 4050:1558:225:900 1300
#
set -euo pipefail

SRC="${1:?source image}"
OUT="${2:?output .webp}"
CROP="${3:?crop as w:h:x:y}"
W="${4:?output width}"
TONE="${5:-0/0 0.25/0.20 0.55/0.68 0.8/0.95 1/1}"

# Endpoints. --ink #0a0f33 and --paper #fbf7ec in docs/index.html, as fractions.
INK_R=0.039; INK_G=0.071; INK_B=0.314
PAP_R=0.980; PAP_G=0.961; PAP_B=0.902

ffmpeg -y -v error -i "$SRC" -vf "\
crop=${CROP},\
scale=${W}:-2:flags=lanczos,\
format=gray,curves=all='${TONE}',format=rgb24,\
curves=r='0/0 0.35/0.14 0.6/0.52 0.85/0.94 1/1':\
g='0/0 0.35/0.13 0.6/0.50 0.85/0.93 1/1':\
b='0/0 0.35/0.55 0.6/0.76 0.85/0.88 1/1',\
colorlevels=romin=${INK_R}:romax=${PAP_R}:gomin=${INK_G}:gomax=${PAP_G}:bomin=${INK_B}:bomax=${PAP_B}\
" -pix_fmt yuv420p -quality 92 "$OUT"

# yuv420p is deliberate and costs nothing here. A duotone carries all of its detail in
# luma, which 4:2:0 keeps at full resolution; the chroma it halves is nearly flat. The
# ffmpeg libwebp encoder only offers 4:2:0 for lossy anyway, and lossless triples the
# file for a difference that is not visible on a two-colour image.

ffprobe -v error -show_entries stream=width,height,pix_fmt -of default=noprint_wrappers=1 "$OUT"
