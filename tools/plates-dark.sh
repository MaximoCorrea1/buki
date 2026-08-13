#!/usr/bin/env bash
#
# tools/plates-dark.sh: the same plate, at night.
#
# WHY THIS IS NOT plates.sh WITH DIFFERENT ENDPOINTS. plates.sh starts from the 4000px
# museum scan, and those scans are not in the repo: they are 30MB Wikimedia originals that
# would dominate it. This starts from the SHIPPED webp instead, which is legitimate
# because of where the colour is applied. plates.sh ends with colorlevels, so the shipped
# file is a duotone whose luma is monotonic in the original's. Pulling that luma back out
# and re-running the last two stages onto a dark pair reproduces the pipeline from the
# spread onward. The tone curve is NOT re-applied, because it is already baked in.
#
# WHY NOT A CSS FILTER. Because a duotone's whole argument is that its two colours are the
# page's two colours, so a full-bleed plate meets the page with no seam. invert() or
# hue-rotate() would give neither of them.
#
# WHY THE TONAL ORDER IS KEPT rather than negated. For a cream headline to clear this
# project's 7:1 bar, the plate's brightest area must sit at or below 0.0806 relative
# luminance. #35457f measures 0.0655, so cream lands at 7.92:1 with the painting's own
# light still reading as light. Negating gives more drama and puts the headline on the
# pale ruin, where it measures worse, and it inverts a credited painting's values.
#
# USAGE
#   tools/plates-dark.sh docs/arch-1400.webp docs/arch-1400-dark.webp
#
# WHAT SHIPPED, 2026-08-13
#   for f in arch-1400 arch-2800 forum-1300 forum-2200; do
#     ./tools/plates-dark.sh "docs/$f.webp" "docs/$f-dark.webp"
#   done
#
# The dark plates are SMALLER than the light ones (125KB against 305KB at 1400) because a
# compressed tonal range carries less for the encoder to keep. Dark mode costs no payload.
set -euo pipefail

SRC="${1:?source, a shipped light plate}"
OUT="${2:?output .webp}"

# The same channel spread plates.sh uses. Blue leads through the shadows, red and green
# overtake it in the highlights, crossing near 0.75.
SPREAD="curves=r='0/0 0.35/0.14 0.6/0.52 0.85/0.94 1/1':\
g='0/0 0.35/0.13 0.6/0.50 0.85/0.93 1/1':\
b='0/0 0.35/0.55 0.6/0.76 0.85/0.88 1/1'"

# Endpoints. Ink #02040b and sky #35457f, as fractions. The sky is the number that had to
# be measured: any lighter and the cream headline drops under 7:1.
DARK_R=0.008; DARK_G=0.014; DARK_B=0.043
SKY_R=0.208;  SKY_G=0.271;  SKY_B=0.498

ffmpeg -y -v error -i "$SRC" -vf "\
format=gray,format=rgb24,${SPREAD},\
colorlevels=romin=${DARK_R}:romax=${SKY_R}:gomin=${DARK_G}:gomax=${SKY_G}:bomin=${DARK_B}:bomax=${SKY_B}\
" -pix_fmt yuv420p -quality 92 "$OUT"

ffprobe -v error -show_entries stream=width,height,pix_fmt -of default=noprint_wrappers=1 "$OUT"
