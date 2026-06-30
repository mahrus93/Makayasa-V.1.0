import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON parsing
  app.use(express.json());

  // API Health Route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Secure Server-side Proxy for Google Sheets CSV and Apps Script Web Apps
  // Bypasses CORS and Iframe Redirection constraints in the browser sandbox.
  app.get("/api/proxy-appscript", async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: "Missing 'url' query parameter" });
    }

    try {
      // Security Validation: Ensure we only proxy trusted Google origins
      if (
        !url.startsWith("https://script.google.com/") && 
        !url.startsWith("https://script.googleusercontent.com/") &&
        !url.startsWith("https://docs.google.com/")
      ) {
        return res.status(400).json({ error: "Only Google Apps Script and Google Sheet URLs are permitted for proxying." });
      }

      console.log(`[PROXY] Fetching from Google Service: ${url}`);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        redirect: "follow" // Ensure redirect (302 Found) to googleusercontent is followed
      });

      if (!response.ok) {
        return res.status(response.status).json({ 
          error: `Google Service responded with status: ${response.status} ${response.statusText}` 
        });
      }

      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("application/json")) {
        const jsonData = await response.json();
        return res.json(jsonData);
      } else {
        const textData = await response.text();
        const trimmed = textData.trim();
        const isHtml = contentType.toLowerCase().includes("text/html") || 
                       trimmed.toLowerCase().startsWith("<!doctype") || 
                       trimmed.toLowerCase().startsWith("<html") || 
                       trimmed.toLowerCase().startsWith("<script") ||
                       trimmed.includes("<body") ||
                       trimmed.includes("google-signin") ||
                       trimmed.includes("Sign in");

        if (isHtml) {
          return res.status(400).json({
            error: "Web App mengembalikan halaman HTML (Google Login/Editor), bukan data JSON. Pastikan Anda mendeploy Apps Script sebagai Web App dengan pengaturan:\n1. Klik 'Terapkan' (Deploy) > 'Penerapan baru' (New deployment)\n2. Pilih tipe: 'Web App'\n3. Jalankan sebagai (Execute as): 'Saya (Me / mahrus0593@gmail.com)'\n4. Siapa yang memiliki akses (Who has access): 'Siapa saja (Anyone)'\n5. Salin URL Web App yang berakhiran '/exec', bukan link editor Apps Script atau Spreadsheet!"
          });
        }

        // If not JSON, but it is valid JSON, try to parse it
        try {
          const parsedJson = JSON.parse(textData);
          return res.json(parsedJson);
        } catch {
          // If not JSON, return as text
          res.setHeader("Content-Type", contentType || "text/plain");
          return res.send(textData);
        }
      }
    } catch (error: any) {
      console.error("[PROXY ERROR] Failed to fetch Google resource:", error);
      return res.status(500).json({ 
        error: error.message || "Unknown proxy error occurred while fetching from Google Services." 
      });
    }
  });

  // Vite Middleware integration for local development hot-reload & asset serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[VITE] Mounted Vite development middleware");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`[PROD] Serving static files from ${distPath}`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Owner Command Center running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[SERVER FATAL] Failed to start express server:", err);
});
