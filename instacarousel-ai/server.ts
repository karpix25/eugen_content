import express from "express";
import { createServer as createViteServer } from "vite";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API to slice image into 2x3 grid
  app.post("/api/slice", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "No image provided" });
      }

      const buffer = Buffer.from(imageBase64.split(",")[1], "base64");
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error("Could not get image dimensions");
      }

      const slideWidth = Math.floor(metadata.width / 2);
      const slideHeight = Math.floor(metadata.height / 3);

      const slices = [];
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 2; x++) {
          const sliceBuffer = await sharp(buffer)
            .extract({
              left: x * slideWidth,
              top: y * slideHeight,
              width: slideWidth,
              height: slideHeight,
            })
            .toBuffer();
          slices.push(`data:image/png;base64,${sliceBuffer.toString("base64")}`);
        }
      }

      res.json({ slices });
    } catch (error: any) {
      console.error("Slicing error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
