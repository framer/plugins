import { framer } from "@framerjs/plugin-api";
import { bytesFromCanvas } from "./utils";

async function flipHorizontally() {
  const image = await framer.getImage()

  if (!image) {
    framer.closePlugin("No Image was selected.", { variant: "error" });
    return;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("ctx is null");
  }

  const { mimeType } = await image.getData();
  const img = await image.loadBitmap();

  ctx.canvas.width = img.width;
  ctx.canvas.height = img.height;

  // Flip the context horizontally
  ctx.scale(-1, 1);
  ctx.drawImage(img, -img.width, 0);

  const result = await bytesFromCanvas(canvas);
  if (!result) {
    throw new Error("Result is not defined");
  }

  await framer.addImage({
    image: { bytes: result, mimeType },
  });

  await framer.closePlugin("Saved");
}

(async () => {
  try {
    await flipHorizontally();
  } catch (err) {
    framer.closePlugin("Unexpected error", { variant: "error" });
  }
})();
