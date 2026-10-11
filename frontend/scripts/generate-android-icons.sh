#!/usr/bin/env sh
set -eu

SOURCE="assets/icon-only.png"
if [ ! -f "$SOURCE" ]; then
  echo "Missing $SOURCE. Generate a 1024x1024 PNG from public/icons/todo-icon.svg first." >&2
  exit 1
fi

for density in ldpi mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  case "$density" in
    ldpi) size=36 ;;
    mdpi) size=48 ;;
    hdpi) size=72 ;;
    xhdpi) size=96 ;;
    xxhdpi) size=144 ;;
    xxxhdpi) size=192 ;;
  esac
  directory="android/app/src/main/res/mipmap-$density"
  mkdir -p "$directory"
  convert "$SOURCE" -resize "${size}x${size}^" -gravity center -extent "${size}x${size}" "$directory/ic_launcher.png"
  midpoint=$((size / 2))
  convert "$SOURCE" -resize "${size}x${size}^" -gravity center -extent "${size}x${size}" \
    \( +clone -alpha extract -fill black -colorize 100 -fill white -draw "circle $midpoint,$midpoint $midpoint,0" \) \
    -compose CopyOpacity -composite "$directory/ic_launcher_round.png"
done
