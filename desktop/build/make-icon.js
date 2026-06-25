// Rasterizes build/icon.svg -> build/icon.png (1024x1024). electron-builder
// generates the platform-specific .icns/.ico from this single PNG automatically.
const path = require("path");
const sharp = require("sharp");

const src = path.join(__dirname, "icon.svg");
const out = path.join(__dirname, "icon.png");

sharp(src, { density: 384 })
  .resize(1024, 1024)
  .png()
  .toFile(out)
  .then(() => console.log("Wrote", out))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
