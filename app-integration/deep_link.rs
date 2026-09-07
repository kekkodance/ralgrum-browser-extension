// Reference parser for ralgrum://open links (v1). Dependency free, std only.
// Copy into the ralgruM app as src/browser_link.rs and wire args handling
// per INTEGRATION.md. Kept in its own module, never in main.rs directly.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BrowserProvider {
    Deezer,
    SoundCloud,
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BrowserKind {
    Track,
    Album,
    Playlist,
    Artist,
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BrowserAction {
    Play,
    Open,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BrowserEntity {
    pub provider: BrowserProvider,
    pub kind: BrowserKind,
    pub id: String,
    pub url: String,
    pub action: BrowserAction,
    pub title: String,
}
fn decode_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = (bytes[i + 1] as char).to_digit(16);
            let lo = (bytes[i + 2] as char).to_digit(16);
            if let (Some(hi), Some(lo)) = (hi, lo) {
                out.push(((hi << 4) | lo) as u8 as char);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            out.push(' ');
        } else {
            out.push(bytes[i] as char);
        }
        i += 1;
    }
    out
}
fn valid_deezer_id(id: &str) -> bool {
    if id.is_empty() || id.len() > 32 {
        return false;
    }
    let mut chars = id.chars();
    match chars.next() {
        Some(first) if first.is_ascii_digit() && first != '0' => {}
        _ => return false,
    }
    id.bytes().all(|b| b.is_ascii_digit())
}
fn parse_provider(value: &str) -> Option<BrowserProvider> {
    match value.trim().to_ascii_lowercase().as_str() {
        "deezer" => Some(BrowserProvider::Deezer),
        "soundcloud" => Some(BrowserProvider::SoundCloud),
        _ => None,
    }
}
fn parse_kind(value: &str) -> Option<BrowserKind> {
    match value.trim().to_ascii_lowercase().as_str() {
        "track" => Some(BrowserKind::Track),
        "album" => Some(BrowserKind::Album),
        "playlist" => Some(BrowserKind::Playlist),
        "artist" => Some(BrowserKind::Artist),
        _ => None,
    }
}
fn parse_action(value: Option<&str>, kind: BrowserKind) -> BrowserAction {
    match value.map(|v| v.trim().to_ascii_lowercase()) {
        Some(action) if action == "play" => BrowserAction::Play,
        Some(action) if action == "open" => BrowserAction::Open,
        _ => {
            if kind == BrowserKind::Track {
                BrowserAction::Play
            } else {
                BrowserAction::Open
            }
        }
    }
}
/// Parses a ralgrum://open URL into a typed entity. Returns None for
/// anything outside the v1 allowlist so callers can ignore it safely.
pub fn parse_ralgrum_url(input: &str) -> Option<BrowserEntity> {
    let input = input.trim();
    if input.len() > 2048 {
        return None;
    }
    let lower = input.to_ascii_lowercase();
    if !lower.starts_with("ralgrum://open") {
        // Also accept a bare query passthrough used by --open-url.
        if !lower.starts_with("ralgrum:open") {
            return None;
        }
    }
    let query = input.splitn(2, '?').nth(1).unwrap_or("");
    let mut provider = None;
    let mut kind = None;
    let mut id = String::new();
    let mut url = String::new();
    let mut action_raw: Option<String> = None;
    let mut title = String::new();
    for pair in query.split('&') {
        if pair.is_empty() {
            continue;
        }
        let mut parts = pair.splitn(2, '=');
        let key = parts.next().unwrap_or("").trim().to_ascii_lowercase();
        let value = decode_component(parts.next().unwrap_or(""));
        match key.as_str() {
            "provider" => provider = parse_provider(&value),
            "type" => kind = parse_kind(&value),
            "id" => id = value.trim().to_owned(),
            "url" => url = value.trim().to_owned(),
            "action" => action_raw = Some(value),
            "title" => {
                let mut short = value.trim().to_owned();
                if short.len() > 200 {
                    short.truncate(200);
                }
                title = short;
            }
            _ => {}
        }
    }
    let provider = provider?;
    let kind = kind?;
    if !url.to_ascii_lowercase().starts_with("https://") {
        return None;
    }
    if provider == BrowserProvider::Deezer {
        if !valid_deezer_id(&id) {
            return None;
        }
    } else if !id.is_empty() {
        // SoundCloud is URL addressed, ignore stray ids.
        id.clear();
    }
    let action = parse_action(action_raw.as_deref(), kind);
    Some(BrowserEntity {
        provider,
        kind,
        id,
        url,
        action,
        title,
    })
}
/// Finds the first ralgrum:// arg in a CLI arg list (skips argv[0]).
pub fn find_browser_link_arg(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|arg| {
            let low = arg.to_ascii_lowercase();
            low.starts_with("ralgrum://") || low.starts_with("ralgrum:") || arg.starts_with("--open-url=")
        })
        .map(|arg| {
            arg.strip_prefix("--open-url=")
                .unwrap_or(arg)
                .trim_matches('"')
                .to_owned()
        })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_deezer_track_with_play() {
        let entity = parse_ralgrum_url("ralgrum://open?provider=deezer&type=track&id=3135556&action=play&url=https%3A%2F%2Fwww.deezer.com%2Ftrack%2F3135556").unwrap();
        assert_eq!(entity.provider, BrowserProvider::Deezer);
        assert_eq!(entity.kind, BrowserKind::Track);
        assert_eq!(entity.id, "3135556");
        assert_eq!(entity.action, BrowserAction::Play);
    }
    #[test]
    fn parses_deezer_album_with_open_default() {
        let entity = parse_ralgrum_url("ralgrum://open?provider=deezer&type=album&id=302127&url=https%3A%2F%2Fwww.deezer.com%2Falbum%2F302127").unwrap();
        assert_eq!(entity.kind, BrowserKind::Album);
        assert_eq!(entity.action, BrowserAction::Open);
    }
    #[test]
    fn parses_soundcloud_track_from_permalink() {
        let entity = parse_ralgrum_url("ralgrum://open?provider=soundcloud&type=track&action=play&url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Fslug").unwrap();
        assert_eq!(entity.provider, BrowserProvider::SoundCloud);
        assert_eq!(entity.kind, BrowserKind::Track);
        assert!(entity.id.is_empty());
    }
    #[test]
    fn rejects_bad_provider_bad_id_and_http_url() {
        assert!(parse_ralgrum_url("ralgrum://open?provider=other&type=track&id=1&url=https%3A%2F%2Fx.com").is_none());
        assert!(parse_ralgrum_url("ralgrum://open?provider=deezer&type=track&id=abc&url=https%3A%2F%2Fwww.deezer.com%2Ftrack%2Fabc").is_none());
        assert!(parse_ralgrum_url("ralgrum://open?provider=deezer&type=track&id=1&url=http%3A%2F%2Fevil.com").is_none());
        assert!(parse_ralgrum_url("https://www.deezer.com/track/1").is_none());
    }
    #[test]
    fn finds_cli_arg_forms() {
        let args = vec!["ralgruM".to_owned(), "ralgrum://open?provider=deezer&type=track&id=1&url=https%3A%2F%2Fx".to_owned()];
        assert!(find_browser_link_arg(&args).is_some());
        let args = vec!["ralgruM".to_owned(), "--open-url=ralgrum://open?provider=deezer&type=track&id=1&url=https%3A%2F%2Fx".to_owned()];
        assert!(find_browser_link_arg(&args).is_some());
        let args = vec!["ralgruM".to_owned()];
        assert!(find_browser_link_arg(&args).is_none());
    }
}
