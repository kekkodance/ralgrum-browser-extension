# Wiring ralgrum:// into the ralgruM app

This guide adds protocol handling to the GPUI app in ralgrum-refactor
without growing main.rs into a monolith. All parsing lives in one focused
module with its own tests.

## 1. Copy the parser

Copy app-integration/deep_link.rs to src/browser_link.rs in the app repo.
Rename module tests stay with the file so cargo test covers the bridge.

## 2. Declare the module

In src/main.rs next to the other mod lines add:

mod browser_link;

Nothing else goes in main.rs except a three line startup check.

## 3. Handle the startup arg

At the top of main(), before GPUI startup, collect args and look for a
browser link:

let pending: Option<browser_link::BrowserEntity> =
    browser_link::find_browser_link_arg(&std::env::args().collect::<Vec<_>>())
        .and_then(|raw| browser_link::parse_ralgrum_url(&raw));

Log it with diagnostics::event and persist it for the UI thread:

- Write the raw URL string to %APPDATA%/ralgruM/browser-link-pending.json
  (field name raw_url plus received_at timestamp).
- On the main view startup, read and delete that file, then route:
  Deezer track with action Play goes to the playback queue resolver,
  albums, playlists, and artists open through the existing Search detail
  renderer using the numeric id or permalink URL.

## 4. Single instance handoff

The GPUI app currently has no single instance guard. Until one exists,
document that a protocol click while the app runs opens a second window
that forwards its pending file and exits. Implement the forwarder as a
small focused helper (for example src/browser_link_handoff.rs) rather
than inline logic in main.rs.

## 5. Register the protocol on Windows

Run protocol/windows-register-protocol.ps1 with the built ralgruM.exe path.
The handler key is HKCU Software Classes ralgrum with a shell open command
of "exe" "%1". No admin rights are required.

## 6. Test plan

- cargo test browser_link covers the parser and CLI forms.
- Manual: register the protocol, open a Deezer track page, click Play in
  ralgruM, confirm the app launches and the pending file appears.
- Manual: repeat for a SoundCloud sets page and a Deezer artist page.
- Extension side: npm test in this repo covers the JS detectors.

## 7. Follow ups (not in v1)

- In-app navigation straight to the entity without restart.
- Optional local HTTP bridge or native messaging host for two way state.
- macOS bundle URL type and Linux desktop file entries.
