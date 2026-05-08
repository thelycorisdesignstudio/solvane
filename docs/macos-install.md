# Solvane macOS install

The current public macOS build is unsigned. Chrome/macOS can add a quarantine flag that shows:

> “Solvane” is damaged and can’t be opened.

That message does not mean the DMG failed to download. It means Gatekeeper blocked an unsigned app that came from the web.

## Working install steps

1. Download `Solvane-macOS-arm64.dmg`.
2. Open the DMG.
3. Drag `Solvane.app` into `/Applications`.
4. Download `Solvane-macOS-First-Launch-Fix.command` from the Solvane downloads section.
5. Right-click the `.command` file and choose **Open**.
6. The script removes quarantine from `/Applications/Solvane.app` and opens Solvane.

Manual equivalent:

```bash
xattr -dr com.apple.quarantine /Applications/Solvane.app
xattr -cr /Applications/Solvane.app
open /Applications/Solvane.app
```

## Production signing path

For a true one-click Mac app, Solvane needs:

- Apple Developer Program account
- Developer ID Application certificate
- notarization credentials
- stapled notarization ticket

The build config includes an ad-hoc signing hook for future macOS CI builds, but ad-hoc signing is not a substitute for Developer ID notarization.
