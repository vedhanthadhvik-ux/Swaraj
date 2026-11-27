"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, type User } from "firebase/auth";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, increment } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Activity, ArrowDown, ArrowRight, BadgeCheck, Bell, Bookmark, Check, ChevronDown, CircleHelp, Compass, ExternalLink, FileCheck2, Flame, Globe2, Heart, ImagePlus, Landmark, Link2, LoaderCircle, LogIn, Menu, MessageCircle, MoreHorizontal, Plus, Search, Send, ShieldAlert, Sparkles, TrendingUp, Users, X } from "lucide-react";
import { auth, db, firebaseConfigured, storage } from "@/lib/firebase";
import type { NewsPost, Verification } from "@/lib/types";

const seedPosts: NewsPost[] = [
  { id: "sample-1", author: "The Civic Desk", handle: "@civicdesk", avatar: "CD", time: "18 min ago", category: "Parliament", title: "What the new session's first bill actually proposes", body: "The bill introduces a phased review process and new reporting requirements. Here are the key sections, what changes now, and the questions lawmakers still need to answer.", image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=85", sourceUrl: "https://sansad.in/", likes: 284, comments: 38, verified: { label: "Mixed evidence", summary: "The post links to a primary-source portal, but the specific bill text is not attached here. Read the bill and compare its provisions with this summary.", checks: ["Open the bill text on the Parliament portal", "Check the bill number and publication date"], caveat: "This sample assessment is illustrative, not a live fact-check." } },
  { id: "sample-2", author: "Ananya Rao", handle: "@ananyarao", avatar: "AR", time: "42 min ago", category: "Public policy", title: "A closer look at the latest rural employment data", body: "I compared the ministry's monthly release with the previous quarter. The headline number is encouraging, but participation varies a lot by state. What context should we add?", sourceUrl: "https://www.data.gov.in/", likes: 156, comments: 24 },
  { id: "sample-3", author: "Rahul Menon", handle: "@rahulmenon", avatar: "RM", time: "1 hr ago", category: "Elections", title: "How to check your voter registration before the next deadline", body: "The Election Commission has an online voter services portal. Sharing the official link and a quick checklist—please flag if your local office has posted an updated deadline.", sourceUrl: "https://voters.eci.gov.in/", likes: 93, comments: 17, verified: { label: "Supported", summary: "The post directs readers to the Election Commission's official voter services portal.", checks: ["Use the official ECI portal", "Confirm state-specific deadlines with your election office"], caveat: "Always confirm current deadlines directly with election officials." } }
];
const categories = ["For you", "Politics", "Parliament", "Elections", "Public policy", "Local government"];
const verificationColor: Record<string, string> = { "Supported": "green", "Mixed evidence": "amber", "Unverified": "gray" };

export default function Home() {
  const [posts, setPosts] = useState<NewsPost[]>(seedPosts);
  const [user, setUser] = useState<User | null>(null);
  const [activeCategory, setActiveCategory] = useState("For you");
  const [queryText, setQueryText] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [commentPost, setCommentPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string[]>>({});
  const [localLikes, setLocalLikes] = useState<Record<string, boolean>>({});
  const [newPost, setNewPost] = useState({ title: "", body: "", category: "Politics", sourceUrl: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [claimText, setClaimText] = useState("");
  const [claimContext, setClaimContext] = useState("");
  const [claimUrl, setClaimUrl] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snapshot => {
      const remote = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as NewsPost));
      if (remote.length) setPosts(remote);
    }, error => console.error("Feed subscription error:", error));
  }, []);

  const visiblePosts = useMemo(() => posts.filter(post => {
    const categoryMatches = activeCategory === "For you" || activeCategory === "Politics" || post.category.toLowerCase() === activeCategory.toLowerCase();
    const searchMatches = !queryText || `${post.title} ${post.body} ${post.author} ${post.category}`.toLowerCase().includes(queryText.toLowerCase());
    return categoryMatches && searchMatches;
  }), [posts, activeCategory, queryText]);

  function toast(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  }

  async function handleSignIn() {
    if (!auth) return toast("Add your Firebase web config to .env.local to enable sign-in.");
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (error) { console.error(error); toast("Sign-in was cancelled or could not be completed."); }
  }

  async function handleSignOut() {
    if (auth) await signOut(auth);
    setMenuOpen(false);
  }

  async function submitPost(event: FormEvent) {
    event.preventDefault();
    if (!newPost.title.trim() || !newPost.body.trim()) return;
    setIsLoading(true);
    try {
      let image = "";
      if (imageFile && storage && user) {
        const imageRef = ref(storage, `posts/${user.uid}/${Date.now()}-${imageFile.name}`);
        await uploadBytes(imageRef, imageFile);
        image = await getDownloadURL(imageRef);
      } else if (imageFile) image = URL.createObjectURL(imageFile);
      const data = { author: user?.displayName || "Community member", handle: user?.email ? `@${user.email.split("@")[0]}` : "@community", avatar: user?.displayName?.slice(0, 2).toUpperCase() || "CM", category: newPost.category, title: newPost.title.trim(), body: newPost.body.trim(), sourceUrl: newPost.sourceUrl.trim(), image, likes: 0, comments: 0, createdAt: serverTimestamp() };
      if (db && user) await addDoc(collection(db, "posts"), { ...data, authorId: user.uid });
      else setPosts(current => [{ ...data, id: `local-${Date.now()}`, time: "just now" }, ...current] as NewsPost[]);
      setComposerOpen(false);
      setNewPost({ title: "", body: "", category: "Politics", sourceUrl: "" });
      setImageFile(null);
      toast(db && user ? "Your post is live." : "Demo post added locally. Connect Firebase to publish for everyone.");
    } catch (error) { console.error(error); toast("Could not publish. Check your Firebase setup and try again."); }
    finally { setIsLoading(false); }
  }

  async function toggleLike(post: NewsPost) {
    const currentLiked = localLikes[post.id] ?? Boolean(post.liked);
    setLocalLikes(current => ({ ...current, [post.id]: !currentLiked }));
    if (db && user && !post.id.startsWith("sample-") && !post.id.startsWith("local-")) {
      try { await updateDoc(doc(db, "posts", post.id), { likes: increment(currentLiked ? -1 : 1) }); }
      catch (error) { console.error(error); toast("Could not save your reaction."); }
    }
  }

  async function runVerification(event: FormEvent) {
    event.preventDefault();
    if (!claimText.trim()) return;
    setIsLoading(true); setVerification(null);
    try {
      const response = await fetch("/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claim: claimText, context: claimContext, sourceUrl: claimUrl }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Analysis failed");
      setVerification(result);
    } catch (error) { toast(error instanceof Error ? error.message : "Could not analyze this claim."); }
    finally { setIsLoading(false); }
  }

  async function submitComment(postId: string, value: string) {
    if (!value.trim()) return;
    setComments(current => ({ ...current, [postId]: [...(current[postId] || []), value.trim()] }));
    setCommentPost(null);
  }

  return <main className="app-shell">
    <aside className="left-rail">
      <a className="brand" href="#top"><span className="brand-mark"><Landmark size={21} strokeWidth={2.2} /></span><span>Swaraj<span className="brand-period">.</span></span></a>
      <div className="rail-label">YOUR SPACE</div>
      <nav className="main-nav">
        <button className="nav-item active"><Compass size={19}/><span>Home</span></button>
        <button className="nav-item" onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}><TrendingUp size={19}/><span>Explore</span></button>
        <button className="nav-item" onClick={() => setVerifyOpen(true)}><FileCheck2 size={19}/><span>Fact check</span><span className="nav-pill">AI</span></button>
        <button className="nav-item" onClick={() => toast("Your saved stories will appear here.")}><Bookmark size={19}/><span>Bookmarks</span></button>
        <button className="nav-item" onClick={() => toast("You're all caught up.")}><Bell size={19}/><span>Notifications</span><span className="notification-dot"/></button>
      </nav>
      <button className="post-button" onClick={() => setComposerOpen(true)}><Plus size={19}/> Share a story</button>
      <div className="rail-community"><div className="community-icon"><Users size={19}/></div><strong>Better informed, together.</strong><p>Bring sources. Ask questions. Make space for every voice.</p><button onClick={() => toast("Community guidelines: be curious, kind, and cite your sources.")}>Our community principles <ArrowRight size={14}/></button></div>
      <div className="rail-bottom"><button className="nav-item small" onClick={() => toast("Swaraj is a citizen-powered public-interest news demo.")}><CircleHelp size={18}/><span>About Swaraj</span></button><button className="profile-row" onClick={user ? () => setMenuOpen(!menuOpen) : handleSignIn}><span className="avatar user-avatar">{user?.displayName?.slice(0, 1) || "G"}</span><span className="profile-copy"><strong>{user?.displayName || "Join the conversation"}</strong><small>{user?.email || "Sign in to post and react"}</small></span><MoreHorizontal size={19}/></button>{menuOpen && <div className="profile-menu"><button onClick={handleSignOut}>Sign out</button></div>}</div>
    </aside>

    <section className="center-column" id="top">
      <header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Landmark size={19}/></span>Swaraj<span className="brand-period">.</span></div><div className="search-box"><Search size={17}/><input aria-label="Search stories" placeholder="Search stories, topics, people..." value={queryText} onChange={event => setQueryText(event.target.value)}/><kbd>⌘ K</kbd></div><div className="top-actions"><button className="icon-button mobile-menu" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20}/></button><button className="icon-button" aria-label="Notifications" onClick={() => toast("You're all caught up.")}><Bell size={19}/><i/></button><button className="top-signin" onClick={user ? handleSignOut : handleSignIn}>{user ? "Sign out" : <><LogIn size={15}/> Sign in</>}</button></div></header>
      <div className="feed-heading"><div><div className="eyebrow"><span className="live-dot"/> THE PUBLIC SQUARE</div><h1>News, with <em>context.</em></h1><p>Stay informed. Ask better questions. Shape the conversation.</p></div><button className="outline-button" onClick={() => setVerifyOpen(true)}><Sparkles size={16}/> Check a claim</button></div>
      <section className="daily-brief"><div className="brief-top"><span><Activity size={15}/> YOUR DAILY BRIEF</span><span>THURSDAY, NOV 27 <ArrowDown size={13}/></span></div><div className="brief-content"><div><strong>What matters in public life today</strong><p>Follow the issues, decisions, and community voices shaping the day.</p></div><button onClick={() => setActiveCategory("Politics")}>Explore today's stories <ArrowRight size={15}/></button></div></section>
      <div className="category-row" id="discover">{categories.map((category, index) => <button key={category} className={`category-chip ${activeCategory === category ? "selected" : ""}`} onClick={() => setActiveCategory(category)}>{index === 0 && <Flame size={15}/ >}{category}</button>)}</div>
      <div className="feed-toolbar"><span><strong>{activeCategory === "For you" ? "Your feed" : activeCategory}</strong><span className="feed-count"> · {visiblePosts.length} stories</span></span><button className="sort-button" onClick={() => toast("Showing the latest community stories.")}>Latest <ChevronDown size={15}/></button></div>
      <div className="feed-list">{visiblePosts.length ? visiblePosts.map(post => <article className="story-card" key={post.id}>
        <div className="story-author"><span className={`avatar ${post.avatar.length < 3 ? "avatar-color" : "avatar-brand"}`}>{post.avatar}</span><div className="author-meta"><strong>{post.author}{post.author === "The Civic Desk" && <BadgeCheck size={14} className="verified-author"/>}</strong><span>{post.handle} <i>·</i> {post.time} <i>·</i> <span className="story-category">{post.category}</span></span></div><button className="more-button" aria-label="More story options" onClick={() => toast("Story options: report, share, or save.")}><MoreHorizontal size={20}/></button></div>
        <h2>{post.title}</h2><p className="story-body">{post.body}</p>
        {post.image && <img className="story-image" src={post.image} alt="Illustrative news image"/>}
        {post.sourceUrl && <a className="source-link" href={post.sourceUrl} target="_blank" rel="noreferrer"><Link2 size={14}/><span>{new URL(post.sourceUrl).hostname.replace("www.", "")}</span><ExternalLink size={12}/></a>}
        {post.verified && <div className={`verification-card ${verificationColor[post.verified.label]}`}><div className="verification-head"><span><ShieldAlert size={15}/> COMMUNITY CONTEXT</span><strong>{post.verified.label}</strong></div><p>{post.verified.summary}</p><small>{post.verified.caveat}</small></div>}
        <div className="story-actions"><button className={localLikes[post.id] ?? post.liked ? "liked" : ""} onClick={() => toggleLike(post)}><Heart size={17} fill={(localLikes[post.id] ?? post.liked) ? "currentColor" : "none"}/>{(post.likes || 0) + ((localLikes[post.id] ?? post.liked) ? 1 : 0)}</button><button onClick={() => setCommentPost(commentPost === post.id ? null : post.id)}><MessageCircle size={17}/>{(post.comments || 0) + (comments[post.id]?.length || 0)}<span> thoughtful replies</span></button><button className="action-spacer" onClick={() => toast("Story saved to your reading list.")}><Bookmark size={17}/></button><button onClick={() => toast("Share link copied when hosted.")}><ExternalLink size={16}/></button></div>
        {commentPost === post.id && <CommentBox onSubmit={value => submitComment(post.id, value)}/>}
        {comments[post.id]?.map((comment, index) => <div className="local-comment" key={`${post.id}-${index}`}><span className="avatar comment-avatar">Y</span><p><strong>You</strong><br/>{comment}</p></div>)}
      </article>) : <div className="empty-state"><Search size={22}/><strong>No stories found</strong><p>Try a different search or topic.</p><button onClick={() => {setQueryText("");setActiveCategory("For you");}}>Clear filters</button></div>}</div>
      <footer className="feed-footer"><Globe2 size={14}/> Built for curious citizens, wherever you are.</footer>
    </section>

    <aside className="right-rail">
      <div className="right-header"><span className="eyebrow">A HEALTHIER FEED</span><button className="icon-button" aria-label="Options" onClick={() => toast("Personalize your feed by following topics.")}><MoreHorizontal size={19}/></button></div>
      <div className="right-card verify-promo"><div className="promo-icon"><Sparkles size={18}/></div><span className="mini-label">GEMINI-ASSISTED</span><h3>Pause before you share.</h3><p>Explore a claim with AI, look for context, and follow the sources yourself.</p><button onClick={() => setVerifyOpen(true)}>Check a claim <ArrowRight size={15}/></button><small>AI is fallible. It doesn't prove a story true.</small></div>
      <div className="right-card trend-card"><div className="card-title"><div><span className="eyebrow">ON THE RADAR</span><h3>Topics to explore</h3></div><TrendingUp size={18}/></div>{[{name:"Public policy",posts:"2.4k conversations"},{name:"Your local community",posts:"1.8k conversations"},{name:"Parliament watch",posts:"968 conversations"}].map((item, index) => <button className="trend-item" key={item.name} onClick={() => setActiveCategory(index === 2 ? "Parliament" : index === 0 ? "Public policy" : "Politics")}><span className="trend-index">0{index + 1}</span><span><strong>{item.name}</strong><small>{item.posts}</small></span><ArrowRight size={15}/></button>)}</div>
      <div className="right-card guidelines"><div className="guidelines-icon"><Users size={17}/></div><div><strong>Good conversations start with us.</strong><p>Be kind. Cite sources. Stay curious.</p><button onClick={() => toast("Community guidelines: respect people, challenge ideas, and share reliable sources.")}>Read our guidelines <ArrowRight size={13}/></button></div></div>
      <div className="right-disclaimer">Swaraj is a civic conversation platform, not a news publisher. AI-generated content may be inaccurate and is not a substitute for independent verification.<div><a href="#top">About</a><a href="#top">Privacy</a><a href="#top">Guidelines</a><span>© 2026 Swaraj</span></div></div>
    </aside>

    {composerOpen && <Modal title="Share with the community" onClose={() => setComposerOpen(false)}><form className="modal-form" onSubmit={submitPost}><label>Headline<input required maxLength={160} placeholder="What happened?" value={newPost.title} onChange={e => setNewPost({ ...newPost, title: e.target.value })}/></label><label>Your context<textarea required maxLength={3000} rows={4} placeholder="Share what you know and why it matters. Add context, not just a headline." value={newPost.body} onChange={e => setNewPost({ ...newPost, body: e.target.value })}/></label><div className="form-two"><label>Topic<select value={newPost.category} onChange={e => setNewPost({ ...newPost, category: e.target.value })}>{categories.slice(1).map(item => <option key={item}>{item}</option>)}</select></label><label>Source link (optional)<input type="url" placeholder="https://..." value={newPost.sourceUrl} onChange={e => setNewPost({ ...newPost, sourceUrl: e.target.value })}/></label></div><label className="upload-label"><ImagePlus size={16}/> {imageFile ? imageFile.name : "Add an image"}<input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)}/></label><div className="modal-note"><ShieldAlert size={15}/> Share responsibly. AI analysis is not proof of truth.</div><button className="primary-button" disabled={isLoading}>{isLoading ? <LoaderCircle className="spin" size={17}/> : <Send size={16}/>} Publish story</button>{!user && <p className="demo-note">Not signed in: this story will be added to your local demo only. Sign in to publish publicly.</p>}</form></Modal>}
    {verifyOpen && <Modal title="Explore a claim" onClose={() => {setVerifyOpen(false);setVerification(null);}}><form className="modal-form" onSubmit={runVerification}><p className="modal-intro">Share a claim and any context or source links. Gemini can help you think through it—but this is not an independent fact-check.</p><label>Claim to explore<textarea required rows={3} maxLength={2000} placeholder="What specific statement would you like to examine?" value={claimText} onChange={e => setClaimText(e.target.value)}/></label><label>Context or source excerpts (optional)<textarea rows={3} maxLength={4000} placeholder="Paste relevant text from a source. The tool does not open or verify links." value={claimContext} onChange={e => setClaimContext(e.target.value)}/></label><label>Source URL (optional)<input type="url" placeholder="https://..." value={claimUrl} onChange={e => setClaimUrl(e.target.value)}/></label><div className="modal-note"><ShieldAlert size={15}/> AI may be wrong. Check original documents and independent sources.</div><button className="primary-button" disabled={isLoading}>{isLoading ? <><LoaderCircle className="spin" size={17}/> Analyzing…</> : <><Sparkles size={16}/> Analyze with Gemini</>}</button></form>{verification && <div className={`result-panel ${verificationColor[verification.label]}`}><div className="result-label"><span><Sparkles size={16}/> AI-ASSISTED ASSESSMENT</span><strong>{verification.label}</strong></div><p>{verification.summary}</p>{verification.checks.length > 0 && <ul>{verification.checks.map((check, index) => <li key={index}><Check size={14}/>{check}</li>)}</ul>}<small>{verification.caveat}</small><div className="result-disclaimer">This is not a verdict that the claim is true or false. Verify independently.</div></div>}</Modal>}
    {notice && <div className="toast"><Check size={16}/>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}
  </main>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal"><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button></header>{children}</section></div>;
}

function CommentBox({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");
  return <form className="comment-form" onSubmit={event => { event.preventDefault(); onSubmit(value); setValue(""); }}><span className="avatar comment-avatar">Y</span><input aria-label="Write a thoughtful reply" placeholder="Add a thoughtful reply…" value={value} onChange={event => setValue(event.target.value)}/><button aria-label="Send reply" disabled={!value.trim()}><Send size={16}/></button></form>;
}
