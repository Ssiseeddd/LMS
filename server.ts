import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON middleware to parse configurations from the client
  app.use(express.json());

  const envPath = path.join(process.cwd(), ".env");

  // Helper inside server to read credentials
  function getEnvConfigs() {
    let url = process.env.VITE_SUPABASE_URL || "";
    let key = process.env.VITE_SUPABASE_ANON_KEY || "";

    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf8");
        const lines = content.split("\n");
        for (const line of lines) {
          const matchUrl = line.match(/^\s*VITE_SUPABASE_URL\s*=\s*["']?(.*?)["']?\s*$/);
          if (matchUrl) {
            url = matchUrl[1];
          }
          const matchKey = line.match(/^\s*VITE_SUPABASE_ANON_KEY\s*=\s*["']?(.*?)["']?\s*$/);
          if (matchKey) {
            key = matchKey[1];
          }
        }
      } catch (e) {
        console.error("Error reading .env file:", e);
      }
    }
    return { url, key };
  }

  // REST API Endpoint to retrieve stored credentials
  app.get("/api/db-config", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const config = getEnvConfigs();
    res.json({
      url: config.url || process.env.VITE_SUPABASE_URL || "",
      key: config.key || process.env.VITE_SUPABASE_ANON_KEY || "",
    });
  });

  // REST API Endpoint to save credentials permanently to `.env`
  app.post("/api/db-config", (req, res) => {
    try {
      const { url, key } = req.body;
      const cleanUrl = (url || "").trim();
      const cleanKey = (key || "").trim();

      // Read current content of .env (or .env.example fallback)
      let content = "";
      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, "utf8");
      } else {
        const examplePath = path.join(process.cwd(), ".env.example");
        if (fs.existsSync(examplePath)) {
          content = fs.readFileSync(examplePath, "utf8");
        }
      }

      // Update VITE_SUPABASE_URL
      if (content.includes("VITE_SUPABASE_URL")) {
        content = content.replace(/^\s*VITE_SUPABASE_URL\s*=\s*.*$/m, `VITE_SUPABASE_URL="${cleanUrl}"`);
      } else {
        content += `\nVITE_SUPABASE_URL="${cleanUrl}"`;
      }

      // Update VITE_SUPABASE_ANON_KEY
      if (content.includes("VITE_SUPABASE_ANON_KEY")) {
        content = content.replace(/^\s*VITE_SUPABASE_ANON_KEY\s*=\s*.*$/m, `VITE_SUPABASE_ANON_KEY="${cleanKey}"`);
      } else {
        content += `\nVITE_SUPABASE_ANON_KEY="${cleanKey}"`;
      }

      fs.writeFileSync(envPath, content, "utf8");

      // Update running server variables to be instantly live
      process.env.VITE_SUPABASE_URL = cleanUrl;
      process.env.VITE_SUPABASE_ANON_KEY = cleanKey;

      console.log("Supabase credentials saved successfully to the server filesystem.");
      res.json({ success: true, message: "Credentials persisted to server .env successfully" });
    } catch (err: any) {
      console.error("Failed persisting Supabase credentials:", err);
      res.status(500).json({ success: false, message: err?.message || "Failed saving credentials to disk" });
    }
  });

  // API route for health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
