//! Explicit administrator-registered aliases for the fixed server-side root.
//! Aliases must come from administrator-managed registration, never client discovery.
#[derive(Debug, PartialEq, Eq)]
pub enum StorageBackend {
    DirectFilesystem,
    ProtectedFilesystem {
        root_id: String,
        relative_path: String,
    },
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Registration {
    pub root_id: String,
    pub aliases: Vec<String>,
}

fn normalized(path: &str) -> Result<String, String> {
    let p = path.replace('/', "\\");
    let trimmed = p.trim_end_matches('\\');
    let p = if trimmed.len() == 2 && trimmed.as_bytes()[1] == b':' {
        format!("{trimmed}\\")
    } else {
        trimmed.to_string()
    };
    if p.starts_with(r"\\?\")
        || p.starts_with(r"\\.\")
        || !(p.starts_with(r"\\")
            || (p.len() >= 3 && p.as_bytes()[1] == b':' && p.as_bytes()[2] == b'\\'))
    {
        return Err("Unsupported Windows path namespace".into());
    }
    for (i, component) in p.split('\\').enumerate() {
        if component == "."
            || component == ".."
            || component.ends_with(' ')
            || component.ends_with('.')
            || component.contains(':') && !(i == 0 && component.len() == 2)
        {
            return Err("Ambiguous path or traversal rejected".into());
        }
    }
    Ok(p.to_ascii_lowercase())
}

pub fn resolve(path: &str, roots: &[Registration]) -> Result<StorageBackend, String> {
    let p = normalized(path)?;
    let original = path.replace('/', "\\");
    let original = original.trim_end_matches('\\');
    let mut matches = Vec::new();
    for root in roots {
        for alias in &root.aliases {
            let a = normalized(alias)?;
            if p == a || p.starts_with(&format!("{a}\\")) {
                matches.push((
                    root.root_id.clone(),
                    original[a.len()..].trim_start_matches('\\').to_string(),
                ));
            }
        }
    }
    matches.sort();
    matches.dedup();
    match matches.len() {
        0 => Ok(StorageBackend::DirectFilesystem),
        1 => {
            let (root_id, relative_path) = matches.remove(0);
            Ok(StorageBackend::ProtectedFilesystem {
                root_id,
                relative_path,
            })
        }
        _ => Err("Conflicting protected root registrations".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn maps_explicit_local_unc_aliases_and_preserves_direct_paths() {
        let roots = [Registration {
            root_id: "test".into(),
            aliases: vec![
                r"D:\MGO-Test".into(),
                r"\\DEV\MGO-Test".into(),
                r"\\DEV\D\MGO-Test".into(),
            ],
        }];
        for path in [
            r"d:\mgo-test\Order.pdf",
            r"\\dev\MGO-TEST\order.pdf",
            r"\\DEV\D\MGO-Test\order.pdf\",
        ] {
            assert_eq!(
                resolve(path, &roots).unwrap(),
                StorageBackend::ProtectedFilesystem {
                    root_id: "test".into(),
                    relative_path: if path.contains("Order.pdf") {
                        "Order.pdf"
                    } else {
                        "order.pdf"
                    }
                    .into()
                }
            );
        }
        assert_eq!(
            resolve(r"D:\MGO-Test2\x", &roots).unwrap(),
            StorageBackend::DirectFilesystem
        );
        assert_eq!(
            resolve(r"D:\", &roots).unwrap(),
            StorageBackend::DirectFilesystem
        );
        assert!(resolve(r"D:\MGO-Test\..\secret", &roots).is_err());
        assert!(resolve(r"D:\MGO-Test\a:stream", &roots).is_err());
    }
}
