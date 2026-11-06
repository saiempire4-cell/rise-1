import { useCallback, useEffect, useRef, useState } from "react";
import { api, initials, timeLabel } from "./api.js";

function Wordmark({ light = false }) {
  return <a className={`wordmark ${light ? "wordmark-light" : ""}`} href="/" aria-label="Rise 1 home">
    <span className="brand-symbol">r<span>1</span></span><span>rise<span className="brand-dot">.</span></span>
  </a>;
}

function Landing() {
  return <main className="landing">
    <nav className="site-nav wrap"><Wordmark /><div className="nav-links"><a href="#why">Why Rise</a><a href="#promise">Our promise</a></div><a className="button button-dark nav-cta" href="/app">Open the app <span>↗</span></a></nav>
    <section className="hero wrap">
      <div className="hero-copy"><span className="eyebrow"><span className="pulse-dot" /> A little more human</span>
        <h1>Make room<br />for <em>real</em> connection.</h1>
        <p className="hero-lede">A quieter place for the people who matter. Thoughtful conversations, without the noise.</p>
        <div className="hero-actions"><a className="button button-dark" href="/app">Find your people <span>↗</span></a><span className="tiny-note">A fresh start, one conversation at a time.</span></div>
      </div>
      <div className="hero-art" aria-label="Illustration of a private conversation"><div className="art-glow" />
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="floating-note note-top"><span className="mini-avatars"><i>J</i><i>M</i></span><span>just between us</span><span className="lock">⌑</span></div>
        <div className="chat-card"><div className="card-top"><span className="avatar avatar-sage">J</span><div><b>Jamie</b><small>your safe place</small></div><span className="card-menu">•••</span></div>
          <div className="chat-date">TODAY, 10:42 AM</div><div className="bubble bubble-them">I kept thinking about what you said yesterday.</div><div className="bubble bubble-you">I'm glad you told me. I'm here, always.</div><div className="message-status">Delivered <span>✓✓</span></div>
          <div className="fake-composer"><span>Write something kind…</span><i>↑</i></div></div>
        <div className="floating-note note-bottom"><span className="sparkle">✳</span><span>your words stay yours</span></div>
      </div>
    </section>
    <section className="ticker"><div>LESS NOISE <span>✳</span> MORE MEANING <span>✳</span> JUST YOU & YOUR PEOPLE <span>✳</span> LESS NOISE <span>✳</span> MORE MEANING <span>✳</span></div></section>
    <section className="manifesto wrap" id="why"><div className="section-index">01 — A DIFFERENT KIND OF SPACE</div><div><h2>Not another feed.<br /><em>A feeling.</em></h2><p>We made Rise 1 for the conversations that deserve your full attention. No audience. No algorithms trying to keep you scrolling. Just a little room to show up for each other.</p><a className="text-link" href="/app">Start a conversation <span>↗</span></a></div></section>
    <section className="promise" id="promise"><div className="promise-inner wrap"><div><div className="section-index">02 — WHAT MATTERS HERE</div><h2>Trust is built<br />in the <em>little things.</em></h2></div><div className="promise-list"><article><span>01</span><div><h3>Only the people you choose.</h3><p>Your conversations are between you and the person you’re talking to. No public profiles or open inboxes.</p></div><b>↗</b></article><article><span>02</span><div><h3>A calmer corner of the internet.</h3><p>Just messages and people you care about. We’re here for meaningful, not more.</p></div><b>↗</b></article><article><span>03</span><div><h3>Honest about privacy.</h3><p>We protect your account and keep messages private from other users. This early version is not end-to-end encrypted—learn more in the app.</p></div><b>↗</b></article></div></div></section>
    <section className="closing wrap"><span className="eyebrow">YOUR PEOPLE ARE HERE</span><h2>Say the thing<br />you <em>mean.</em></h2><a className="button button-dark" href="/app">Come on in <span>↗</span></a><div className="closing-flower">✳</div></section>
    <footer className="site-footer wrap"><Wordmark /><span>Made for the moments that matter.</span><a href="/app">Open Rise 1 ↗</a></footer>
  </main>;
}

function Avatar({ name, tone = "" }) {
  return <span className={`avatar ${tone}`} aria-hidden="true">{initials(name)}</span>;
}

function Auth({ onLogin }) {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const result = await api(`/auth/${signup ? "register" : "login"}`, {
        method: "POST",
        body: { username: fields.get("username"), password: fields.get("password"), displayName: fields.get("displayName") },
      });
      onLogin(result.user);
    } catch (problem) { setError(problem.message); } finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-visual"><Wordmark light /><div className="auth-quote"><span className="eyebrow">A PRIVATE PLACE TO BEGIN</span><h1>Some things<br />are better<br /><em>between us.</em></h1><p>Come as you are. Find your people.</p></div><div className="auth-footnote">RISE 1 · A LITTLE MORE HUMAN</div><span className="auth-orb" /></div>
    <div className="auth-panel"><a className="back-home" href="/">← Back to home</a><form className="auth-form" onSubmit={submit}><span className="eyebrow">{signup ? "YOUR NEXT CHAPTER" : "GOOD TO SEE YOU"}</span><h2>{signup ? "Make yourself at home." : "Welcome back."}</h2><p>{signup ? "Create an account and find your people." : "Pick up right where you left off."}</p>
      {signup && <label>Your name<input name="displayName" autoComplete="name" maxLength="40" placeholder="What should we call you?" /></label>}
      <label>Username<input name="username" required autoComplete="username" minLength="3" maxLength="24" pattern="[A-Za-z0-9_]+" placeholder="e.g. river_day" /></label>
      <label>Password<input name="password" required type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 12 : 1} maxLength="72" placeholder={signup ? "12+ characters · max 72 bytes" : "Your password"} /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="button button-dark form-submit" disabled={busy}>{busy ? "One moment…" : signup ? "Create your account" : "Sign in"} <span>↗</span></button>
      <div className="auth-switch">{signup ? "Already found us?" : "New around here?"} <button type="button" onClick={() => { setSignup(!signup); setError(""); }}>{signup ? "Sign in" : "Create an account"}</button></div>
      <div className="privacy-callout"><span>⌑</span><p><b>A note on privacy</b><br />Messages are stored on our server and aren’t end-to-end encrypted yet. Please don’t share anything highly sensitive.</p></div>
    </form></div></main>;
}

function AppShell({ user, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileChat, setMobileChat] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const active = conversations.find((item) => item.id === activeId);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api("/conversations");
      setConversations(data.conversations);
      setActiveId((current) => current && data.conversations.some((c) => c.id === current)
        ? current : data.conversations[0]?.id ?? null);
    } catch (problem) { setError(problem.message); }
  }, []);

  useEffect(() => { loadConversations().finally(() => setLoading(false)); }, [loadConversations]);
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timeout = setTimeout(() => api(`/users?q=${encodeURIComponent(query.trim())}`)
      .then((data) => setResults(data.users)).catch((problem) => setError(problem.message)), 220);
    return () => clearTimeout(timeout);
  }, [query]);

  const loadMessages = useCallback(async () => {
    if (!activeId) { setMessages([]); return; }
    try {
      const data = await api(`/conversations/${activeId}/messages`);
      setMessages(data.messages);
      setError("");
      loadConversations();
    } catch (problem) { setError(problem.message); }
  }, [activeId, loadConversations]);
  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  async function startConversation(person) {
    try {
      const data = await api("/conversations", { method: "POST", body: { userId: person.id } });
      await loadConversations();
      setActiveId(data.conversation.id);
      setQuery(""); setResults([]); setMobileChat(true);
    } catch (problem) { setError(problem.message); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form).get("message")?.trim();
    if (!body || !activeId) return;
    setSending(true);
    try {
      await api(`/conversations/${activeId}/messages`, { method: "POST", body: { body } });
      form.reset();
      await loadMessages();
    } catch (problem) { setError(problem.message); } finally { setSending(false); }
  }

  return <main className="messenger">
    <aside className={`sidebar ${mobileChat ? "sidebar-hidden" : ""}`}><div className="side-top"><Wordmark /><button className="icon-btn" title="Start a conversation" onClick={() => document.querySelector(".people-search")?.focus()}>＋</button></div>
      <div className="side-greeting"><span>YOUR LITTLE CORNER</span><h1>People first.</h1></div>
      <label className="search-wrap"><span>⌕</span><input className="people-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find someone…" /></label>
      {query && <div className="search-results">{results.length ? results.map((person) => <button key={person.id} onClick={() => startConversation(person)}><Avatar name={person.displayName} /><span><b>{person.displayName}</b><small>@{person.username}</small></span><span className="result-arrow">↗</span></button>) : <div className="empty-search">{query.length < 2 ? "Type at least two characters" : "No one here by that name yet"}</div>}</div>}
      <div className="conversation-heading"><span>YOUR PEOPLE</span><span>{conversations.length.toString().padStart(2, "0")}</span></div>
      <div className="conversation-list">{loading ? <div className="sidebar-empty">Gathering your people…</div> : conversations.length ? conversations.map((conversation, i) => <button key={conversation.id} className={`conversation-row ${activeId === conversation.id ? "selected" : ""}`} onClick={() => { setActiveId(conversation.id); setMobileChat(true); }}>
        <Avatar name={conversation.user.displayName} tone={`tone-${i % 4}`} /><span className="conversation-copy"><b>{conversation.user.displayName}</b><small>{conversation.lastMessage || `@${conversation.user.username}`}</small></span><span className="conversation-meta">{conversation.lastMessageAt && <small>{timeLabel(conversation.lastMessageAt)}</small>}{conversation.unreadCount > 0 && <i>{conversation.unreadCount}</i>}</span></button>) : <div className="sidebar-empty">Your people will show up here.<br />Find someone to say hello.</div>}</div>
      <div className="sidebar-bottom"><div className="profile-chip"><Avatar name={user.displayName} tone="tone-profile" /><span><b>{user.displayName}</b><small>@{user.username}</small></span><button onClick={onLogout} aria-label="Sign out" title="Sign out">↗</button></div></div>
    </aside>
    <section className={`chat-area ${mobileChat ? "chat-mobile-active" : ""}`}>
      {active ? <><header className="chat-header"><button className="back-chat" onClick={() => setMobileChat(false)}>← <span>People</span></button><Avatar name={active.user.displayName} tone="tone-header" /><div className="chat-person"><b>{active.user.displayName}</b><small>@{active.user.username}</small></div><div className="header-note"><span className="pulse-dot" /> Just between you two</div><button className="header-menu" aria-label="Conversation details">•••</button></header>
        {error && <div className="inline-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
        <div className="message-scroll">{messages.length ? <><div className="conversation-intro"><span className="intro-mark">✳</span><p>This is your space with <b>{active.user.displayName}</b>.<br />Just the two of you, taking it as it comes.</p></div><div className="day-divider"><span /> TODAY <span /></div>
          {messages.map((message, index) => { const own = message.senderId === user.id; const previous = messages[index - 1]; const showTime = !previous || new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > 5 * 60 * 1000; return <div key={message.id} className={`message-line ${own ? "own-message" : ""}`}>{showTime && <time>{own ? "YOU" : active.user.displayName.toUpperCase()} · {timeLabel(message.createdAt)}</time>}<div className={`message-bubble ${own ? "message-own" : "message-other"}`}>{message.body}</div></div>; })}
          <div ref={bottomRef} /></> : <div className="empty-conversation"><div className="empty-flower">✳</div><span className="eyebrow">A GOOD PLACE TO BEGIN</span><h2>Every close thing<br />started with <em>hello.</em></h2><p>No rush. Say what feels right.</p></div>}</div>
        <form className="composer" onSubmit={sendMessage}><div className="composer-wrap"><textarea name="message" maxLength="2000" rows="1" placeholder={`Message ${active.user.displayName}…`} aria-label="Write a message" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }} /><button disabled={sending} aria-label="Send message">↑</button></div><div className="composer-hint"><span>Just between you two <i>⌑</i></span><span>Enter to send · Shift + Enter for a new line</span></div></form>
      </> : <><header className="chat-header empty-header"><span className="header-note"><span className="pulse-dot" /> A quieter kind of connection</span></header>{error && <div className="inline-error" role="alert">{error}</div>}<div className="empty-welcome"><div className="welcome-orbit"><span>✳</span></div><span className="eyebrow">WELCOME TO YOUR SPACE</span><h2>More listening.<br /><em>Less everything else.</em></h2><p>Find someone you care about and start a conversation. Good things can begin with a simple hello.</p><button className="button button-dark" onClick={() => document.querySelector(".people-search")?.focus()}>Find your people <span>↗</span></button></div></>}
    </section>
  </main>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const isApp = window.location.pathname === "/app" || window.location.pathname.startsWith("/app/");
  useEffect(() => {
    if (isApp) api("/me").then((data) => setUser(data.user)).catch(() => {}).finally(() => setChecking(false));
    else setChecking(false);
  }, [isApp]);
  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); setUser(null); }
    catch (error) { window.alert(error.message); }
  }
  if (!isApp) return <Landing />;
  if (checking) return <main className="loading-screen"><Wordmark /><span>Making a little room…</span></main>;
  if (!user) return <Auth onLogin={setUser} />;
  return <AppShell user={user} onLogout={logout} />;
}
