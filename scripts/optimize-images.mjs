import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const INPUT_DIR = "assets/images/new";
const OUTPUT_DIR = "assets/images/case-studies/enablement/";

const AVIF_QUALITY = 58;
const WEBP_QUALITY = 84;
const JPEG_QUALITY = 86;

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg"]);

const IMAGE_CONFIG = {
  "enab-card-header": {
    widths: [600, 900, 1200],
    mode: "banner",
    // keep this wide and intentionally cropped for the card
    aspectRatio: 3 / 2
  },
  "plat-figure-1": {
    widths: [768, 1200, 1536],
    mode: "responsive"
  },
  "plat-figure-2": {
    widths: [768, 1200, 1536],
    mode: "responsive"
  },
};

function isImageFile(file) {
  return IMAGE_EXTS.has(path.extname(file).toLowerCase());
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFormats(img, outBase, ext, outputPathBase) {
  await img.clone().avif({ quality: AVIF_QUALITY }).toFile(`${outputPathBase}/${outBase}.avif`);
  await img.clone().webp({ quality: WEBP_QUALITY }).toFile(`${outputPathBase}/${outBase}.webp`);

  if (ext === ".png") {
    await img.clone().png({ compressionLevel: 9 }).toFile(`${outputPathBase}/${outBase}.png`);
  } else {
    await img.clone().jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toFile(`${outputPathBase}/${outBase}.jpg`);
  }
}

async function processOne(file) {
  const inPath = path.join(INPUT_DIR, file);
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file, ext);
  const config = IMAGE_CONFIG[base];

  if (!config) {
    console.log(`Skipping ${file} (no config found)`);
    return;
  }

  const img = sharp(inPath).rotate().toColourspace("srgb");
  const meta = await img.metadata();

  console.log(`Processing ${file} (${meta.width}x${meta.height})`);

  for (const w of config.widths) {
    if (meta.width && w > meta.width) continue;

    let pipeline = img.clone();

    if (config.mode === "responsive") {
      pipeline = pipeline.resize({
        width: w,
        withoutEnlargement: true
      });
    }

    if (config.mode === "banner") {
      const height = Math.round(w / config.aspectRatio);
      pipeline = pipeline.resize({
        width: w,
        height,
        fit: "cover",
        position: "attention",
        withoutEnlargement: true
      });
    }

    if (config.mode === "figure-16x9") {
      const height = Math.round(w / config.aspectRatio);
      pipeline = pipeline.resize({
        width: w,
        height,
        fit: "cover",
        position: "attention",
        withoutEnlargement: true
      });
    }

    await writeFormats(pipeline, `${base}-${w}w`, ext, OUTPUT_DIR);
  }
}

async function main() {
  await ensureDir(OUTPUT_DIR);

  const files = await fs.readdir(INPUT_DIR);
  const images = files.filter(isImageFile);

  for (const file of images) {
    await processOne(file);
  }

  console.log(`Done. Optimized images in ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});