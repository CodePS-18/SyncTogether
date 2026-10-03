import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell, LogOut, Plus, Search, Users, Play, Settings, MessageCircle,
  Send, Smile, Copy, X, Menu, Film, ChevronRight
} from 'lucide-react';
import { useAuth } from './auth';
import api from './api';

export function Logo() {
  return <Link to="/dashboard" className="flex items-center gap-2 font-black text-xl">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500"><Play size={18} fill="currentColor" /></span>
    SyncTogether
  </Link>;
}

export function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090d]/85 backdrop-blur-xl">
    <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
      <Logo />
      <div className="hidden flex-1 md:flex">
        <div className="ml-6 flex w-full max-w-md items-center gap-2 rounded-xl bg-white/5 px-3">
          <Search size={17} className="text-slate-400" />
          <input className="w-full bg-transparent py-2.5 outline-none" placeholder="Search rooms..." />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button className="btn-secondary p-2"><Bell size={18} /></button>
        <Link to="/profile" className="hidden items-center gap-2 rounded-xl bg-white/5 px-3 py-2 sm:flex">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-indigo-500 text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</div>
          <span className="text-sm">{user?.username}</span>
        </Link>
        <button className="btn-secondary p-2" onClick={async () => { await logout(); nav('/login') }}><LogOut size={18} /></button>
      </div>
    </div>
  </header>;
}

export function Layout({ children }) {
  return <div className="min-h-screen"><Navbar /><main className="mx-auto max-w-7xl px-4 py-6">{children}</main></div>;
}

export function RoomCard({ room }) {
  return <Link to={`/rooms/${room.room_code}`} className="card block p-5 transition hover:-translate-y-1 hover:border-indigo-400/40">
    <div className="mb-4 flex items-start justify-between">
      <div className="rounded-xl bg-indigo-500/15 p-3 text-indigo-300"><Film size={22} /></div>
      <span className={`rounded-full px-2.5 py-1 text-xs ${room.is_private ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
        {room.is_private ? 'Private' : 'Public'}
      </span>
    </div>
    <h3 className="font-bold">{room.name}</h3>
    <p className="mt-1 line-clamp-2 text-sm text-slate-400">{room.description || 'Watch together in real time.'}</p>
    <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
      <span>@{room.host_username}</span>
      <span className="flex items-center gap-1"><Users size={15} />{room.participants}/{room.max_participants}</span>
    </div>
  </Link>;
}

export function ChatPanel({ socket, messages, setMessages }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  const send = () => {
    if (!text.trim()) return;
    socket?.emit('chat-message', { message: text });
    setText('');
  };
  return <section className="card flex min-h-[420px] flex-col">
    <div className="flex items-center gap-2 border-b border-white/10 p-4 font-bold"><MessageCircle size={18} /> Live Chat</div>
    <div className="flex-1 space-y-3 overflow-auto p-4">
      {messages.map(m => <div key={m.id} className="flex gap-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-500 text-xs font-bold">{m.user?.username?.[0]?.toUpperCase()}</div>
        <div><div className="text-xs font-semibold">{m.user?.username}</div><div className="text-sm text-slate-300">{m.message}</div></div>
      </div>)}
      <div ref={endRef} />
    </div>
    <div className="flex gap-2 border-t border-white/10 p-3">
      <input className="input" maxLength="1000" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." />
      <button className="btn-primary px-3" onClick={send}><Send size={18} /></button>
    </div>
  </section>;
}

export function Reactions({ socket }) {
  const reactions = ['❤️', '😂', '😍', '😮', '👏', '🔥', '👍', '🎉'];
  const [floating, setFloating] = useState([]);
  useEffect(() => {
    if (!socket) return;
    const fn = (r) => {
      const id = crypto.randomUUID();
      setFloating(x => [...x, { ...r, id }]);
      setTimeout(() => setFloating(x => x.filter(a => a.id !== id)), 2500);
    };
    socket.on('reaction', fn);
    return () => {
      socket.off('reaction', fn);
    };
  }, [socket]);
  return <>
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center gap-4">{floating.map(r => <div key={r.id} className="animate-bounce text-4xl">{r.reactionType}</div>)}</div>
    <div className="flex gap-1 overflow-auto">{reactions.map(r => <button key={r} className="rounded-lg bg-white/5 p-2 text-xl hover:bg-white/10" onClick={() => socket?.emit('reaction', { reactionType: r })}>{r}</button>)}</div>
  </>;
}

export function Playlist({ items, onPlay, onAdd, onRemove, isHost }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: '', url: '' });
  return <section className="card overflow-hidden">
    <div className="flex items-center justify-between border-b border-white/10 p-4">
      <div className="font-bold">Playlist</div>
      {isHost && <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setShow(!show)}><Plus size={16} /> Add</button>}
    </div>
    {show && <div className="space-y-2 border-b border-white/10 p-3">
      <input className="input" placeholder="Video title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <input className="input" placeholder="Direct MP4 URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
      <button className="btn-primary w-full" onClick={() => { onAdd(form); setForm({ title: '', url: '' }); setShow(false) }}>Add video</button>
    </div>}
    <div className="max-h-64 overflow-auto">
      {items.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">No videos yet.</div> :
        items.map((x, i) => <div key={x.id} className="flex items-center gap-3 border-b border-white/5 p-3 last:border-0">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-xs">{i + 1}</div>
          <button className="min-w-0 flex-1 text-left" onClick={() => onPlay(x.media_id)}><div className="truncate text-sm font-semibold">{x.title}</div><div className="text-xs text-slate-500">Play now</div></button>
          {isHost && <button className="text-slate-500 hover:text-rose-300" onClick={() => onRemove(x.id)}><X size={16} /></button>}
        </div>)}
    </div>
  </section>;
}

export function Player({ media, socket, isHost, syncState }) {
  const ref = useRef(null);
  const applying = useRef(false);
  useEffect(() => {
    const video = ref.current;
    if (!video || !syncState) return;
    applying.current = true;
    const serverPosition = Number(syncState.position || 0);
    if (Math.abs(video.currentTime - serverPosition) > 0.8) video.currentTime = serverPosition;
    const desired = Boolean(syncState.isPlaying);
    const p = desired ? video.play() : video.pause();

    Promise.resolve(p)
      .catch(() => { })
      .finally(() => {
        setTimeout(() => {
          applying.current = false;
        }, 100);
      });

  }, [syncState?.position, syncState?.isPlaying, media?.id]);
  if (!media) return <div className="grid aspect-video place-items-center rounded-2xl border border-white/10 bg-black text-slate-500">Choose a video from the playlist.</div>;
  return <div className="overflow-hidden rounded-2xl bg-black shadow-2xl">

    <video
      ref={ref}
      className="aspect-video w-full"
      src={media.url}
      controls
      playsInline
      preload="metadata"
      onError={(e) => {
        console.error("Video failed to load:", media.url, e.currentTarget.error);
      }}
      onLoadedMetadata={() => {
        console.log("Video loaded:", media.title);
      }}
      onPlay={() => {
        if (isHost && !applying.current) {
          socket?.emit("play", {
            position: ref.current.currentTime
          });
        }
      }}
      onPause={() => {
        if (isHost && !applying.current) {
          socket?.emit("pause", {
            position: ref.current.currentTime
          });
        }
      }}
      onSeeked={() => {
        if (isHost && !applying.current) {
          socket?.emit("seek", {
            position: ref.current.currentTime
          });
        }
      }}
    />

    <div className="flex items-center justify-between bg-black/60 px-4 py-3">
      <div><div className="font-semibold">{media.title}</div><div className="text-xs text-slate-500">{isHost ? 'You control playback' : 'Playback controlled by host'}</div></div>
    </div>
  </div>;
}
