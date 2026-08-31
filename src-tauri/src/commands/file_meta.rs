use serde::Serialize;
use std::path::Path;
use regex::Regex;

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

fn get_pdf_dimensions(file_path: &Path) -> Option<(f64, f64)> {
    let bytes = std::fs::read(file_path).ok()?;
    let text: String = bytes.iter().map(|&b| b as char).collect();

    let re = Regex::new(r"/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]").ok()?;
    let caps = re.captures(&text)?;

    let x1: f64 = caps[1].parse().ok()?;
    let y1: f64 = caps[2].parse().ok()?;
    let x2: f64 = caps[3].parse().ok()?;
    let y2: f64 = caps[4].parse().ok()?;

    Some(((x2 - x1).abs(), (y2 - y1).abs()))
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

    match image::open(file_path) {
        Ok(img) => {
            let width_px = img.width();
            let height_px = img.height();
            let color_mode = match img.color() {
                image::ColorType::Rgb8 | image::ColorType::Rgb16 | image::ColorType::Rgb32F => "RGB",
                image::ColorType::Rgba8 | image::ColorType::Rgba16 | image::ColorType::Rgba32F => "RGB",
                image::ColorType::L8 | image::ColorType::L16 => "Grayscale",
                image::ColorType::La8 | image::ColorType::La16 => "Grayscale",
                _ => "unknown",
            }
            .to_string();

            let dpi = 96.0;
            let panjang_m = ((width_px as f64 / dpi) * 0.0254 * 100.0).round() / 100.0;
            let lebar_m = ((height_px as f64 / dpi) * 0.0254 * 100.0).round() / 100.0;

            FileMeta {
                color_mode,
                width_px: Some(width_px),
                height_px: Some(height_px),
                dpi: Some(dpi),
                dpi_detected: false,
                panjang_m: Some(panjang_m),
                lebar_m: Some(lebar_m),
            }
        }
        Err(_) => FileMeta::empty(),
    }
}
