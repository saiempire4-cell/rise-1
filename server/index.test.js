import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "./index.js";
import { createDatabase } from "./db.js";

const origin = "http://localhost:5173";
let server;
let baseUrl;
let db;
const request = async (path, { method = "GET", body, cookie, requestOrigin = origin } = {}) => {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(requestOrigin ? { origin: requestOrigin } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, data: response.status === 204 ? null : await response.json(), cookie: response.headers.get("set-cookie") };
};
const sessionCookie = (setCookie) => setCookie?.split(";")[0];

beforeEach(async () => {
  db = createDatabase(":memory:");
  server = createServer(createApp({ db, origin, authAttemptLimit: 100, serveStatic: false }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

test("registration, sign-in and sessions persist without exposing password data", async () => {
  const invalid = await request("/auth/register", { method: "POST", body: { username: "ivy", password: "short" } });
  assert.equal(invalid.response.status, 400);
  const created = await request("/auth/register", { method: "POST", body: { username: "ivy", displayName: "Ivy Lane", password: "private phrase 123" } });
  assert.equal(created.response.status, 201);
  const cookie = sessionCookie(created.cookie);
  assert.match(created.cookie, /HttpOnly/);
  assert.equal(created.data.user.displayName, "Ivy Lane");
  assert.equal("password_hash" in created.data.user, false);
  const tokenHash = db.prepare("SELECT token_hash FROM sessions WHERE user_id = ?").get(created.data.user.id).token_hash;
  assert.notEqual(tokenHash, cookie.slice("rise_session=".length));
  const me = await request("/me", { cookie });
  assert.equal(me.data.user.username, "ivy");
  assert.equal((await request("/me", { cookie: "rise_session=%" })).response.status, 401);
  assert.equal((await request("/auth/register", { method: "POST", body: { username: "IVY", password: "another private phrase" } })).response.status, 409);
  assert.equal((await request("/auth/login", { method: "POST", body: { username: "ivy", password: "wrong private phrase" } })).response.status, 401);
  const loggedIn = await request("/auth/login", { method: "POST", body: { username: "IVY", password: "private phrase 123" } });
  assert.equal(loggedIn.response.status, 200);
  assert.equal((await request("/auth/logout", { method: "POST", cookie })).response.status, 204);
  assert.equal((await request("/me", { cookie })).response.status, 401);
});

test("conversation membership controls message access and messages persist", async () => {
  const ivy = await request("/auth/register", { method: "POST", body: { username: "ivy", password: "private phrase 123" } });
  const noa = await request("/auth/register", { method: "POST", body: { username: "noa", password: "another private 123" } });
  const outsider = await request("/auth/register", { method: "POST", body: { username: "sage", password: "different private 123" } });
  await request("/auth/register", { method: "POST", body: { username: "river_day", password: "a river private 123" } });
  const ivyCookie = sessionCookie(ivy.cookie);
  const noaCookie = sessionCookie(noa.cookie);
  const outsiderCookie = sessionCookie(outsider.cookie);
  const users = await request("/users?q=no", { cookie: ivyCookie });
  assert.equal(users.data.users[0].username, "noa");
  assert.deepEqual((await request("/users?q=_", { cookie: ivyCookie })).data.users.map((person) => person.username), ["river_day"]);
  assert.equal((await request("/users?q=%", { cookie: ivyCookie })).data.users.length, 0);
  const started = await request("/conversations", { method: "POST", cookie: ivyCookie, body: { userId: noa.data.user.id } });
  assert.equal(started.response.status, 201);
  const id = started.data.conversation.id;
  assert.equal((await request(`/conversations/${id}/messages`, { cookie: outsiderCookie })).response.status, 404);
  assert.equal((await request(`/conversations/${id}/messages`, { method: "POST", cookie: outsiderCookie, body: { body: "No access" } })).response.status, 404);
  const sent = await request(`/conversations/${id}/messages`, { method: "POST", cookie: ivyCookie, body: { body: "  Hey, glad you’re here.  " } });
  assert.equal(sent.response.status, 201);
  assert.equal(sent.data.message.body, "Hey, glad you’re here.");
  assert.equal((await request("/conversations", { cookie: noaCookie })).data.conversations[0].unreadCount, 1);
  const received = await request(`/conversations/${id}/messages`, { cookie: noaCookie });
  assert.equal(received.data.messages[0].body, sent.data.message.body);
  assert.equal((await request("/conversations", { cookie: noaCookie })).data.conversations[0].unreadCount, 0);
  const duplicate = await request("/conversations", { method: "POST", cookie: noaCookie, body: { userId: ivy.data.user.id } });
  assert.equal(duplicate.data.conversation.id, id);
  assert.equal((await request("/conversations", { cookie: noaCookie })).data.conversations[0].lastMessage, sent.data.message.body);
});

test("mutations require the configured origin and reject oversized messages", async () => {
  const missingRoute = await request("/not-a-route");
  assert.equal(missingRoute.response.status, 404);
  assert.deepEqual(missingRoute.data, { error: "API route not found." });
  const ivy = await request("/auth/register", { method: "POST", body: { username: "ivy", password: "private phrase 123" } });
  const noa = await request("/auth/register", { method: "POST", body: { username: "noa", password: "another private 123" } });
  const cookie = sessionCookie(ivy.cookie);
  const forbidden = await request("/conversations", { method: "POST", cookie, requestOrigin: "https://attacker.example", body: { userId: noa.data.user.id } });
  assert.equal(forbidden.response.status, 403);
  const started = await request("/conversations", { method: "POST", cookie, body: { userId: noa.data.user.id } });
  const tooLong = await request(`/conversations/${started.data.conversation.id}/messages`, { method: "POST", cookie, body: { body: "x".repeat(2001) } });
  assert.equal(tooLong.response.status, 400);
});

test("production startup requires a strong session secret", () => {
  assert.throws(() => createApp({ db, origin, production: true, sessionSecret: "too-short", serveStatic: false }), /SESSION_SECRET/);
  assert.ok(createApp({ db, origin, production: true, sessionSecret: "x".repeat(32), serveStatic: false }));
});
