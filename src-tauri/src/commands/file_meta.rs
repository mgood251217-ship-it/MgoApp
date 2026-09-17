use serde::Serialize;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct FileMeta {
    #[serde(rename = "colorMode")]
    pub color_mode: String,
    #[serde(rename = "widthPx")]
    pub width_px: Option<u32>,
    #[serde(rename = "heightPx")]
    pub height_px: Option<u32>,
    pub dpi: Option<f64>,
    #[serde(rename = "dpiDetected")]
    pub dpi_detected: bool,
    #[serde(rename = "panjangM")]
    pub panjang_m: Option<f64>,
    #[serde(rename = "lebarM")]
    pub lebar_m: Option<f64>,
}

impl FileMeta {
    fn empty() -> Self {
        FileMeta {
            color_mode: "unknown".into(),
            width_px: None,
            height_px: None,
            dpi: None,
            dpi_detected: false,
            panjang_m: None,
            lebar_m: None,
        }
    }
}

fn rounded_meters(pixels: u32, dpi: f64) -> f64 {
    ((pixels as f64 / dpi) * 0.0254 * 100.0).round() / 100.0
}

fn raster_meta(width: u32, height: u32, color_mode: &str, dpi: Option<f64>) -> FileMeta {
    let effective_dpi = dpi.filter(|value| *value > 0.0).unwrap_or(96.0);
    FileMeta {
        color_mode: color_mode.into(),
        width_px: Some(width),
        height_px: Some(height),
        dpi: Some(effective_dpi),
        dpi_detected: dpi.is_some(),
        panjang_m: Some(rounded_meters(width, effective_dpi)),
        lebar_m: Some(rounded_meters(height, effective_dpi)),
    }
}

fn read_prefix(file_path: &Path, max_bytes: usize) -> Option<Vec<u8>> {
    let mut file = File::open(file_path).ok()?;
    let length = file.metadata().ok()?.len().min(max_bytes as u64) as usize;
    let mut bytes = vec![0; length];
    file.read_exact(&mut bytes).ok()?;
    Some(bytes)
}

fn read_u16(bytes: &[u8], offset: usize, little_endian: bool) -> Option<u16> {
    let value = bytes.get(offset..offset + 2)?;
    Some(if little_endian {
        u16::from_le_bytes([value[0], value[1]])
    } else {
        u16::from_be_bytes([value[0], value[1]])
    })
}

fn read_u32(bytes: &[u8], offset: usize, little_endian: bool) -> Option<u32> {
    let value = bytes.get(offset..offset + 4)?;
    Some(if little_endian {
        u32::from_le_bytes([value[0], value[1], value[2], value[3]])
    } else {
        u32::from_be_bytes([value[0], value[1], value[2], value[3]])
    })
}

fn get_png_meta(bytes: &[u8]) -> Option<(u32, u32, String, Option<f64>)> {
    if bytes.get(0..8)? != b"\x89PNG\r\n\x1a\n" {
        return None;
    }
    let width = read_u32(bytes, 16, false)?;
    let height = read_u32(bytes, 20, false)?;
    let color_mode = match *bytes.get(25)? {
        0 | 4 => "Grayscale",
        2 | 6 => "RGB",
        3 => "Indexed",
        _ => "unknown",
    };

    let mut offset = 8;
    let mut dpi = None;
    while offset + 12 <= bytes.len() {
        let length = read_u32(bytes, offset, false)? as usize;
        let chunk_type = bytes.get(offset + 4..offset + 8)?;
        let data_start = offset + 8;
        let data_end = data_start.checked_add(length)?;
        if data_end > bytes.len() {
            break;
        }
        if chunk_type == b"pHYs" && length >= 9 && bytes[data_start + 8] == 1 {
            let pixels_per_meter = read_u32(bytes, data_start, false)? as f64;
            dpi = Some(pixels_per_meter * 0.0254);
            break;
        }
        offset = data_end.checked_add(4)?;
    }

    Some((width, height, color_mode.into(), dpi))
}

fn get_jpeg_meta(bytes: &[u8]) -> Option<(u32, u32, String, Option<f64>)> {
    if bytes.get(0..2)? != [0xff, 0xd8] {
        return None;
    }
    let mut offset = 2;
    let mut dpi = None;
    while offset + 4 <= bytes.len() {
        if bytes[offset] != 0xff {
            offset += 1;
            continue;
        }
        while bytes.get(offset) == Some(&0xff) {
            offset += 1;
        }
        let marker = *bytes.get(offset)?;
        offset += 1;
        if marker == 0xd9 || marker == 0xda {
            break;
        }
        let segment_length = read_u16(bytes, offset, false)? as usize;
        if segment_length < 2 || offset + segment_length > bytes.len() {
            break;
        }
        let data = &bytes[offset + 2..offset + segment_length];
        if marker == 0xe0 && data.len() >= 12 && &data[0..5] == b"JFIF\0" {
            let units = data[7];
            let x_density = read_u16(data, 8, false)? as f64;
            let y_density = read_u16(data, 10, false)? as f64;
            dpi = match units {
                1 => Some((x_density + y_density) / 2.0),
                2 => Some((x_density + y_density) / 2.0 * 2.54),
                _ => None,
            };
        }
        if matches!(marker, 0xc0..=0xc3 | 0xc5..=0xc7 | 0xc9..=0xcb | 0xcd..=0xcf) && data.len() >= 6 {
            let height = read_u16(data, 1, false)? as u32;
            let width = read_u16(data, 3, false)? as u32;
            let color_mode = match data[5] {
                1 => "Grayscale",
                3 => "RGB",
                4 => "CMYK",
                _ => "unknown",
            };
            return Some((width, height, color_mode.into(), dpi));
        }
        offset += segment_length;
    }
    None
}

fn get_jpeg_meta_from_file(file_path: &Path) -> Option<(u32, u32, String, Option<f64>)> {
    let mut file = File::open(file_path).ok()?;
    let file_len = file.metadata().ok()?.len();
    let max_bytes = file_len.min(8 * 1024 * 1024) as usize;
    let mut bytes = Vec::with_capacity(max_bytes);
    let mut chunk = [0u8; 64 * 1024];

    while bytes.len() < max_bytes {
        let remaining = max_bytes - bytes.len();
        let read_size = remaining.min(chunk.len());
        let read_count = file.read(&mut chunk[..read_size]).ok()?;
        if read_count == 0 {
            break;
        }
        bytes.extend_from_slice(&chunk[..read_count]);
        if let Some(meta) = get_jpeg_meta(&bytes) {
            return Some(meta);
        }
    }

    None
}

fn get_psd_meta(bytes: &[u8]) -> Option<(u32, u32, String, Option<f64>)> {
    if bytes.get(0..4)? != b"8BPS" || read_u16(bytes, 4, false)? != 1 {
        return None;
    }
    let height = read_u32(bytes, 14, false)?;
    let width = read_u32(bytes, 18, false)?;
    let color_mode = match read_u16(bytes, 24, false)? {
        0 => "Bitmap",
        1 => "Grayscale",
        2 => "Indexed",
        3 => "RGB",
        4 => "CMYK",
        7 => "Multichannel",
        8 => "Duotone",
        9 => "Lab",
        _ => "unknown",
    };
    Some((width, height, color_mode.into(), None))
}

fn get_tiff_meta(bytes: &[u8]) -> Option<(u32, u32, String, Option<f64>)> {
    let little_endian = match bytes.get(0..2)? {
        b"II" => true,
        b"MM" => false,
        _ => return None,
    };
    if read_u16(bytes, 2, little_endian)? != 42 {
        return None;
    }
    let ifd_offset = read_u32(bytes, 4, little_endian)? as usize;
    let entries = read_u16(bytes, ifd_offset, little_endian)? as usize;
    let mut width = None;
    let mut height = None;
    let mut samples = 1u32;
    let mut photometric = None;
    let mut x_resolution = None;
    let mut resolution_unit = 2u16;

    for index in 0..entries {
        let entry = ifd_offset + 2 + index * 12;
        let tag = read_u16(bytes, entry, little_endian)?;
        let field_type = read_u16(bytes, entry + 2, little_endian)?;
        let count = read_u32(bytes, entry + 4, little_endian)? as usize;
        let value_size = match field_type {
            3 => 2 * count,
            4 => 4 * count,
            5 => 8 * count,
            _ => continue,
        };
        let value_offset = if value_size <= 4 { entry + 8 } else { read_u32(bytes, entry + 8, little_endian)? as usize };
        let value = match field_type {
            3 => read_u16(bytes, value_offset, little_endian)? as f64,
            4 => read_u32(bytes, value_offset, little_endian)? as f64,
            5 => {
                let numerator = read_u32(bytes, value_offset, little_endian)? as f64;
                let denominator = read_u32(bytes, value_offset + 4, little_endian)? as f64;
                if denominator == 0.0 { continue; }
                numerator / denominator
            }
            _ => continue,
        };
        match tag {
            256 => width = Some(value as u32),
            257 => height = Some(value as u32),
            277 => samples = value as u32,
            262 => photometric = Some(value as u16),
            282 => x_resolution = Some(value),
            296 => resolution_unit = value as u16,
            _ => {}
        }
    }

    let color_mode = match photometric {
        Some(0 | 1) => "Grayscale",
        Some(2) => "RGB",
        Some(3) => "Indexed",
        Some(5) => "CMYK",
        _ if samples >= 3 => "RGB",
        _ => "unknown",
    };
    let dpi = x_resolution.map(|value| if resolution_unit == 3 { value * 2.54 } else { value });
    Some((width?, height?, color_mode.into(), dpi))
}

fn get_pdf_dimensions(file_path: &Path) -> Option<(f64, f64)> {
    let mut file = File::open(file_path).ok()?;
    let file_len = file.metadata().ok()?.len();
    let scan_len = file_len.min(256 * 1024) as usize;
    let mut bytes = vec![0; scan_len];
    file.read_exact(&mut bytes).ok()?;

    if file_len > bytes.len() as u64 {
        let tail_len = file_len.min(64 * 1024) as usize;
        file.seek(SeekFrom::End(-(tail_len as i64))).ok()?;
        let mut tail = vec![0; tail_len];
        file.read_exact(&mut tail).ok()?;
        bytes.extend_from_slice(&tail);
    }

    let text = String::from_utf8_lossy(&bytes);
    let marker = b"/MediaBox";
    let marker_pos = bytes.windows(marker.len()).position(|window| window == marker)?;
    let values = text[marker_pos + marker.len()..]
        .split(|ch: char| ch == '[' || ch == ']' || ch.is_ascii_whitespace())
        .filter(|value| !value.is_empty())
        .take(4)
        .map(|value| value.parse::<f64>().ok())
        .collect::<Option<Vec<_>>>()?;

    if values.len() != 4 {
        return None;
    }

    Some(((values[2] - values[0]).abs(), (values[3] - values[1]).abs()))
}

pub fn get_file_meta(file_path: &Path) -> FileMeta {
    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "cdr" {
        return FileMeta {
            color_mode: "-".into(),
            ..FileMeta::empty()
        };
    }

    if ext == "pdf" {
        return match get_pdf_dimensions(file_path) {
            Some((width_pt, height_pt)) => {
                let panjang_m = ((width_pt / 72.0) * 0.0254 * 100.0).round() / 100.0;
                let lebar_m = ((height_pt / 72.0) * 0.0254 * 100.0).round() / 100.0;
                FileMeta {
                    color_mode: "unknown".into(),
                    width_px: None,
                    height_px: None,
                    dpi: Some(72.0),
                    dpi_detected: true,
                    panjang_m: Some(panjang_m),
                    lebar_m: Some(lebar_m),
                }
            }
            None => FileMeta::empty(),
        };
    }

    let raster_ext = ["jpg", "jpeg", "png", "tif", "tiff", "psd"];
    if !raster_ext.contains(&ext.as_str()) {
        return FileMeta::empty();
    }

    let parsed = if matches!(ext.as_str(), "jpg" | "jpeg") {
        get_jpeg_meta_from_file(file_path)
    } else {
        let bytes = match read_prefix(file_path, 256 * 1024) {
            Some(bytes) => bytes,
            None => return FileMeta::empty(),
        };
        match ext.as_str() {
            "png" => get_png_meta(&bytes),
            "tif" | "tiff" => get_tiff_meta(&bytes),
            "psd" => get_psd_meta(&bytes),
            _ => None,
        }
    };

    match parsed {
        Some((width, height, color_mode, dpi)) => raster_meta(width, height, &color_mode, dpi),
        None => FileMeta::empty(),
    }
}
