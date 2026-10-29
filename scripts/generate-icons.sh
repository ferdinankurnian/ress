#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Render the vector at each target size; never upscale a small raster.
rsvg-convert -w 1024 -h 1024 assets/icon-mark.svg -o assets/adaptive-icon.png
cp assets/adaptive-icon.png assets/android-icon-foreground.png
sed 's/#25271F/#FFFFFF/g' assets/icon-mark.svg | rsvg-convert -w 1024 -h 1024 -o assets/android-icon-monochrome.png
magick -size 1024x1024 xc:'#F5D547' assets/adaptive-icon.png -composite assets/icon.png
magick -size 1024x1024 xc:'#F5D547' assets/android-icon-background.png
rsvg-convert -w 192 -h 192 assets/icon-mark.svg | magick - -background '#F5D547' -alpha remove assets/favicon.png
