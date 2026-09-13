import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./lib/errors.js";
import { meRouter } from "./routes/me.js";
import { groupsRouter } from "./routes/groups.js";
import { sessionsRouter } from "./routes/sessions.js";
import { soloRouter } from "./routes/solo.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const origins = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173").split(",").map((s) => s.trim());

app.use(helmet());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Everything under /api requires a valid Firebase ID token.
const api = express.Router();
api.use(requireAuth);
api.use("/me", meRouter);
api.use("/groups", groupsRouter);
api.use("/groups/:groupId/sessions", sessionsRouter);
api.use("/solo", soloRouter);
app.use("/api", api);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
