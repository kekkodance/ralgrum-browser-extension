# ralgrum protocol spec (v1)

The extension opens the ralgruM desktop app through custom protocol URLs.
Windows hands these URLs to the registered handler, which launches ralgruM
with the URL as its first argument.

## Format

ralgrum://open with query provider, type, id, action, url, title.
See app-integration/deep_link.rs for the normative parser.

Params: provider (deezer or soundcloud, required), type (track, album,
playlist, artist, required), id (numeric Deezer id, required for Deezer),
url (original https page URL, required), action (play or open, default play
for track else open), title (optional display hint, max 200 chars).
Unknown params are ignored. Max total URL length is 2048 chars.

## Examples (percent encoding as sent on the wire)

Deezer track 3135556, plays immediately:
ralgrum://open with provider=deezer, type=track, id=3135556, action=play,
url=https://www.deezer.com/track/3135556

Deezer album 302127:
ralgrum://open with provider=deezer, type=album, id=302127, action=open,
url=https://www.deezer.com/album/302127

Deezer playlist 13743145521:
ralgrum://open with provider=deezer, type=playlist, id=13743145521,
action=open, url=https://www.deezer.com/playlist/13743145521

Deezer artist 27:
ralgrum://open with provider=deezer, type=artist, id=27, action=open,
url=https://www.deezer.com/artist/27

SoundCloud track (permalink addressed, no id):
ralgrum://open with provider=soundcloud, type=track, action=play,
url=https://soundcloud.com/artist/track-slug

SoundCloud playlist (a sets page):
ralgrum://open with provider=soundcloud, type=playlist, action=open,
url=https://soundcloud.com/artist/sets/mix

Note: url and title values are percent encoded with URLSearchParams on
the sender side and decoded by the app parser. See tests for exact strings.

## App behavior

1. Parse with the deep_link rules.
2. Reject unknown providers, types, bad ids, non https url values.
3. Deezer numeric id opens the matching ralgruM page.
4. SoundCloud resolves the permalink URL inside ralgruM.
5. Second instance forwards the URL to the running app and exits.
6. If ralgruM is missing, the browser shows its unknown protocol prompt
   and the popup offers the original page link as fallback.

## Security notes

- Only https values are accepted for url.
- The handler never executes scripts from params, it only navigates.
- Keep an allowlist of providers and types, ignore everything else.
