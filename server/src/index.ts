import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./lib/errors.js";
import { meRouter } from "./routes/me.js";
import { groupsRouter } from "./routes/groups.js";
import { sessionsRouter } from "./routes/sessions.js";
import { soloRouter } from "./routes/solo.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const isProd = process.env.NODE_ENV === "production";
const origins = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173").split(",").map((s) => s.trim());

app.set("trust proxy", 1); // Railway/Render sit behind a proxy

app.use(
  helmet({
    // The React app is served from this same origin in production, so the
    // browser-side integrations need a couple of relaxations:
    //  - Firebase's Google sign-in popup needs COOP "same-origin-allow-popups"
    //  - CSP is left off so Google Fonts, Firebase and Cloudinary requests aren't blocked
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(isProd ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Everything under /api requires a valid Firebase ID token.
const api = express.Router();
api.use(requireAuth);
api.use("/me", meRouter);
api.use("/groups", groupsRouter);
api.use("/groups/:groupId/sessions", sessionsRouter);
api.use("/solo", soloRouter);
app.use("/api", api);

// In production, serve the built React app from the same server (single Railway service).
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = process.env.CLIENT_DIST ?? path.resolve(here, "../../client/dist");
if (isProd && existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: "1y", index: false }));
  // SPA fallback: any non-API route returns index.html so React Router can handle it.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
  console.log(`Serving client from ${clientDist}`);
} else if (isProd) {
  console.warn(`Client build not found at ${clientDist} — API only`);
}

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
