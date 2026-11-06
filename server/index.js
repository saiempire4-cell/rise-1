import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./db.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "rise_session";
const here = path.dirname(fileURLToPath(import.meta.url));
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("Rise1UnavailableAccount", 12);

const safeEqual = (a, b) => {
  const left = Buffer.from(a ?? "");
  const right = Buffer.from(b ?? "");
  return left.length === right.length && timingSafeEqual(left, right);
};
const cleanUser = ({ id, username, display_name: displayName }) => ({ id, username, displayName });

function getCookie(req, name) {
  const pair = (req.headers.cookie ?? "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : null;
}

function setSessionCookie(res, token, production) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: production,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

function validAccount({ username, password }) {
  return typeof username === "string" && /^[a-zA-Z0-9_]{3,24}$/.test(username)
    && typeof password === "string" && password.length >= 12 && Buffer.byteLength(password, "utf8") <= 72;
}

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function createApp({
  db = createDatabase(process.env.DATABASE_PATH ?? "./data/rise1.sqlite"),
  origin = process.env.APP_ORIGIN ?? "http://localhost:5173",
  production = process.env.NODE_ENV === "production",
  sessionSecret = process.env.SESSION_SECRET ?? "",
  authAttemptLimit = 10,
  serveStatic = true,
} = {}) {
  if (production && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters in production.");
  }
  const hashToken = (token) => createHmac("sha256", sessionSecret || "development-only-not-for-production")
    .update(token).digest("hex");
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  const api = express.Router();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: authAttemptLimit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again in a little while." },
  });

  api.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !safeEqual(req.get("origin"), origin)) {
      return res.status(403).json({ error: "Request origin was not accepted." });
    }
    next();
  });

  const authenticate = (req, res, next) => {
    const token = getCookie(req, COOKIE_NAME);
    if (!token || token.length > 200) return res.status(401).json({ error: "Please sign in to continue." });
    const session = db.prepare(`
      SELECT users.id, users.username, users.display_name, sessions.token_hash
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(hashToken(token), Date.now());
    if (!session) return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    req.user = session;
    next();
  };

  const issueSession = (res, user) => {
    const token = randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(hashToken(token), user.id, Date.now() + SESSION_TTL_MS);
    setSessionCookie(res, token, production);
    return cleanUser(user);
  };

  api.post("/auth/register", authLimiter, asyncHandler(async (req, res) => {
    const { username, password, displayName } = req.body ?? {};
    if (!validAccount({ username, password })) {
      return res.status(400).json({ error: "Choose a 3–24 character username (letters, numbers, underscores) and a password of at least 12 characters (up to 72 UTF-8 bytes)." });
    }
    const name = typeof displayName === "string" ? displayName.trim().slice(0, 40) : "";
    const id = randomUUID();
    try {
      const passwordHash = await bcrypt.hash(password, 12);
      db.prepare("INSERT INTO users (id, username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(id, username, name || username, passwordHash, new Date().toISOString());
      const user = db.prepare("SELECT id, username, display_name FROM users WHERE id = ?").get(id);
      return res.status(201).json({ user: issueSession(res, user) });
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "That username is already taken." });
      throw error;
    }
  }));

  api.post("/auth/login", authLimiter, asyncHandler(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ error: "Enter your username and password." });
    }
    const user = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
    const matches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !matches) return res.status(401).json({ error: "The username or password doesn’t match." });
    return res.json({ user: issueSession(res, user) });
  }));

  api.post("/auth/logout", authenticate, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(req.user.token_hash);
    res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: production, sameSite: "strict", path: "/" });
    return res.status(204).end();
  });

  api.get("/me", authenticate, (req, res) => res.json({ user: cleanUser(req.user) }));
  api.get("/users", authenticate, (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 40) : "";
    if (query.length < 2) return res.json({ users: [] });
    const users = db.prepare(`
      SELECT id, username, display_name FROM users
      WHERE id != ? AND (username LIKE ? ESCAPE char(92) OR display_name LIKE ? ESCAPE char(92))
      ORDER BY username LIMIT 20
    `).all(req.user.id, `%${query.replace(/[\\%_]/g, "\\$&")}%`, `%${query.replace(/[\\%_]/g, "\\$&")}%`);
    return res.json({ users: users.map(cleanUser) });
  });

  api.get("/conversations", authenticate, (req, res) => {
    const conversations = db.prepare(`
      SELECT c.id, other.id AS other_id, other.username AS other_username,
        other.display_name AS other_display_name, m.body AS last_message,
        m.created_at AS last_message_at,
        (SELECT COUNT(*) FROM messages unread
         WHERE unread.conversation_id = c.id AND unread.sender_id != ?
           AND (mine.last_read_at IS NULL OR unread.created_at > mine.last_read_at)) AS unread_count
      FROM conversations c
      JOIN conversation_members mine ON mine.conversation_id = c.id AND mine.user_id = ?
      JOIN conversation_members theirs ON theirs.conversation_id = c.id AND theirs.user_id != ?
      JOIN users other ON other.id = theirs.user_id
      LEFT JOIN messages m ON m.id = (
        SELECT id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC, rowid DESC LIMIT 1
      )
      ORDER BY COALESCE(m.created_at, c.created_at) DESC
    `).all(req.user.id, req.user.id, req.user.id);
    return res.json({ conversations: conversations.map((c) => ({
      id: c.id, user: { id: c.other_id, username: c.other_username, displayName: c.other_display_name },
      lastMessage: c.last_message, lastMessageAt: c.last_message_at, unreadCount: c.unread_count,
    })) });
  });

  api.post("/conversations", authenticate, (req, res) => {
    const otherId = req.body?.userId;
    if (typeof otherId !== "string" || otherId === req.user.id) return res.status(400).json({ error: "Choose another person to start a conversation." });
    const other = db.prepare("SELECT id, username, display_name FROM users WHERE id = ?").get(otherId);
    if (!other) return res.status(404).json({ error: "That account could not be found." });
    const existing = db.prepare(`
      SELECT mine.conversation_id AS id FROM conversation_members mine
      JOIN conversation_members theirs ON theirs.conversation_id = mine.conversation_id
      WHERE mine.user_id = ? AND theirs.user_id = ?
    `).get(req.user.id, otherId);
    if (existing) return res.json({ conversation: { id: existing.id, user: cleanUser(other) } });
    const id = randomUUID();
    const createConversation = db.transaction(() => {
      db.prepare("INSERT INTO conversations (id, created_at) VALUES (?, ?)").run(id, new Date().toISOString());
      db.prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)")
        .run(id, req.user.id, id, otherId);
    });
    createConversation();
    return res.status(201).json({ conversation: { id, user: cleanUser(other) } });
  });

  api.get("/conversations/:id/messages", authenticate, (req, res) => {
    const isMember = db.prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?")
      .get(req.params.id, req.user.id);
    if (!isMember) return res.status(404).json({ error: "Conversation not found." });
    const messages = db.prepare(`
      SELECT id, sender_id, body, created_at FROM (
        SELECT id, sender_id, body, created_at, rowid FROM messages
        WHERE conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 200
      ) ORDER BY created_at ASC, rowid ASC
    `).all(req.params.id);
    db.prepare("UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?")
      .run(new Date().toISOString(), req.params.id, req.user.id);
    return res.json({ messages: messages.map((message) => ({
      id: message.id, senderId: message.sender_id, body: message.body, createdAt: message.created_at,
    })) });
  });

  api.post("/conversations/:id/messages", authenticate, (req, res) => {
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body || body.length > 2000) return res.status(400).json({ error: "Messages must be between 1 and 2,000 characters." });
    const member = db.prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?")
      .get(req.params.id, req.user.id);
    if (!member) return res.status(404).json({ error: "Conversation not found." });
    const message = {
      id: randomUUID(), senderId: req.user.id, body, createdAt: new Date().toISOString(),
    };
    db.prepare("INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(message.id, req.params.id, req.user.id, body, message.createdAt);
    return res.status(201).json({ message });
  });

  api.use((req, res) => res.status(404).json({ error: "API route not found." }));
  app.use("/api", api);
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("Request failed:", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  });

  if (serveStatic) {
    app.use(express.static(path.resolve(here, "../dist")));
    app.get("*", (req, res) => res.sendFile(path.resolve(here, "../dist/index.html")));
  }
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp();
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
  app.listen(port, host, () => console.log(`Rise 1 listening on ${host}:${port}`));
}
