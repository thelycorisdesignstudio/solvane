#!/bin/zsh
set -e
APP="/Applications/Solvane.app"
echo "Solvane macOS first-launch fix"
echo "This removes Chrome/macOS quarantine from the unsigned Solvane app."
if [ ! -d "$APP" ]; then
  echo "Solvane.app was not found in /Applications."
  echo "Please drag Solvane.app from the DMG into Applications, then run this file again."
  read -r "?Press Return to close."
  exit 1
fi
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
xattr -cr "$APP" 2>/dev/null || true
chmod -R u+rwX "$APP" 2>/dev/null || true
echo "Done. Opening Solvane..."
open "$APP"
