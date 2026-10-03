import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth';
import { Layout, RoomCard, Playlist, Player, ChatPanel, Reactions, Logo } from './components';
import api from './api';
import { Plus, Users, ArrowRight, Copy, CheckCircle2 } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { io } from 'socket.io-client';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center">Loading SyncTogether...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AuthShell({ children }) {
  return <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#1d2350,transparent_40%),#08090d] p-4">
    <div className="w-full max-w-md">
      <div className="mb-8 flex justify-center"><Logo /></div>{children}
    </div>
  </div>;
}

function Login() {
  const { login, googleLogin } = useAuth(); const nav = useNavigate();
  const [form, setForm] = useState({ email: 'demo@example.com', password: 'Demo@12345' });
  const [error, setError] = useState('');
  return <AuthShell><form className="card space-y-4 p-6" onSubmit={async e => { e.preventDefault(); setError(''); try { await login(form.email, form.password); nav('/dashboard') } catch (err) { setError(err.response?.data?.message || 'Login failed') } }}>
    <div><h1 className="text-2xl font-black">Welcome back</h1><p className="text-sm text-slate-400">Enter your details to join the watch party.</p></div>
    {error && <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
    <input className="input" type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
    <input className="input" type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
    <button className="btn-primary w-full">Sign in</button>
    <div className="flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-white/10"></span><span>OR</span><span className="h-px flex-1 bg-white/10"></span></div>
    {import.meta.env.VITE_GOOGLE_CLIENT_ID ? <div className="flex justify-center"><GoogleLogin onSuccess={async response => { setError(''); try { await googleLogin(response.credential); nav('/dashboard') } catch (err) { setError(err.response?.data?.message || 'Google login failed') } }} onError={() => setError('Google login failed. Please try again.')} useOneTap={false} /></div> : <p className="text-center text-xs text-amber-300">Google Login is disabled until VITE_GOOGLE_CLIENT_ID is configured.</p>}
    <p className="text-center text-sm text-slate-400">New here? <a className="text-indigo-300" href="/register">Create an account</a></p>
  </form></AuthShell>;
}

function Register() {
  const { register } = useAuth(); const nav = useNavigate();
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '' }); const [error, setError] = useState('');
  return <AuthShell><form className="card space-y-4 p-6" onSubmit={async e => { e.preventDefault(); setError(''); try { await register(form); nav('/dashboard') } catch (err) { setError(err.response?.data?.message || 'Registration failed') } }}>
    <div><h1 className="text-2xl font-black">Create your account</h1><p className="text-sm text-slate-400">Start hosting synchronized entertainment rooms.</p></div>
    {error && <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
    <input className="input" placeholder="Full name" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
    <input className="input" placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
    <input className="input" type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
    <input className="input" type="password" placeholder="Password (8+ characters)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
    <button className="btn-primary w-full">Create account</button>
    <p className="text-center text-sm text-slate-400">Already registered? <a className="text-indigo-300" href="/login">Sign in</a></p>
  </form></AuthShell>;
}

function Dashboard() {
  const { user } = useAuth(); const [rooms, setRooms] = useState([]);
  useEffect(() => { api.get('/rooms').then(r => setRooms(r.data.rooms)).catch(console.error) }, []);
  return <Layout>
    <section className="mb-8 rounded-3xl border border-indigo-400/15 bg-gradient-to-br from-indigo-500/20 to-purple-500/5 p-7">
      <p className="text-sm font-semibold text-indigo-300">REAL-TIME ENTERTAINMENT</p>
      <h1 className="mt-2 text-3xl font-black md:text-4xl">Hey {user?.full_name?.split(' ')[0]}, ready to watch together?</h1>
      <p className="mt-2 max-w-2xl text-slate-400">Create a room, invite friends, and keep every participant synchronized with low-latency room events.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a className="btn-primary" href="/rooms/create"><Plus size={18} /> Create Room</a>
        <a className="btn-secondary" href="/rooms"><Users size={18} /> Browse Rooms</a>
      </div>
    </section>
    <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Public rooms</h2><a className="text-sm text-indigo-300" href="/rooms">View all</a></div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{rooms.slice(0, 6).map(r => <RoomCard key={r.room_code} room={r} />)}</div>
    {!rooms.length && <div className="card p-10 text-center text-slate-500">No public rooms yet. Create one and invite your friends.</div>}
  </Layout>;
}

function Rooms() {
  const [rooms, setRooms] = useState([]); const [q, setQ] = useState('');
  useEffect(() => { api.get('/rooms').then(r => setRooms(r.data.rooms)) }, []);
  const filtered = rooms.filter(r => r.name.toLowerCase().includes(q.toLowerCase()));
  return <Layout><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black">Public Rooms</h1><p className="text-slate-400">Find an active room and join the party.</p></div><a className="btn-primary" href="/rooms/create"><Plus size={18} /> Create</a></div>
    <input className="input mb-6 max-w-lg" placeholder="Search rooms..." value={q} onChange={e => setQ(e.target.value)} />
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filtered.map(r => <RoomCard key={r.room_code} room={r} />)}</div>
  </Layout>;
}

function CreateRoom() {
  const nav = useNavigate(); const [form, setForm] = useState({ name: '', description: '', isPrivate: false, password: '', maxParticipants: 10, allowChat: true, allowReactions: true }); const [error, setError] = useState('');
  return <Layout><div className="mx-auto max-w-2xl"><h1 className="mb-2 text-3xl font-black">Create a room</h1><p className="mb-6 text-slate-400">Set the rules, then share your room code.</p>
    <form className="card space-y-4 p-6" onSubmit={async e => { e.preventDefault(); try { const r = await api.post('/rooms', { ...form, maxParticipants: Number(form.maxParticipants) }); nav(`/rooms/${r.data.room.room_code}`) } catch (err) { setError(err.response?.data?.message || 'Could not create room') } }}>
      {error && <div className="rounded-xl bg-rose-500/10 p-3 text-rose-300">{error}</div>}
      <input className="input" placeholder="Room name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <textarea className="input min-h-28" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      <label className="flex items-center gap-3"><input type="checkbox" checked={form.isPrivate} onChange={e => setForm({ ...form, isPrivate: e.target.checked })} /> Private room</label>
      {form.isPrivate && <input className="input" placeholder="Optional room password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />}
      <input className="input" type="number" min="2" max="100" value={form.maxParticipants} onChange={e => setForm({ ...form, maxParticipants: e.target.value })} />
      <div className="flex gap-5"><label><input type="checkbox" checked={form.allowChat} onChange={e => setForm({ ...form, allowChat: e.target.checked })} /> Chat</label><label><input type="checkbox" checked={form.allowReactions} onChange={e => setForm({ ...form, allowReactions: e.target.checked })} /> Reactions</label></div>
      <button className="btn-primary w-full">Create room</button>
    </form></div></Layout>;
}

function JoinGate({ room, onJoined }) {
  const [password, setPassword] = useState('');
  return <div className="card mx-auto max-w-md p-6"><h2 className="text-xl font-bold">Join {room.name}</h2><p className="mt-1 text-sm text-slate-400">This room is protected.</p><input className="input mt-4" type="password" placeholder="Room password" value={password} onChange={e => setPassword(e.target.value)} /><button className="btn-primary mt-3 w-full" onClick={() => onJoined(password)}>Join room</button></div>;
}

function Room() {
  const { user } = useAuth(); const { pathname } = useLocation(); const code = pathname.split('/').pop();
  const [room, setRoom] = useState(null), [participants, setParticipants] = useState([]), [messages, setMessages] = useState([]), [playlist, setPlaylist] = useState([]), [media, setMedia] = useState(null), [syncState, setSyncState] = useState(null), [socket, setSocket] = useState(null), [error, setError] = useState(''), [joined, setJoined] = useState(false), [copied, setCopied] = useState(false);
  const load = async () => {
    try {
      const [rr, mm, pp] = await Promise.all([api.get(`/rooms/${code}`), api.get(`/rooms/${code}/messages`), api.get(`/rooms/${code}/playlist`)]);
      setRoom(rr.data.room); setParticipants(rr.data.participants); setMessages(mm.data.messages); setPlaylist(pp.data.playlist);
      setJoined(rr.data.participants.some(x => x.id === user.id));
      if (rr.data.room.current_url) setMedia({ id: rr.data.room.current_media_id, title: rr.data.room.current_title, url: rr.data.room.current_url });
      setSyncState({ position: rr.data.room.current_position, isPlaying: rr.data.room.is_playing });
    } catch (err) { setError(err.response?.data?.message || 'Unable to load room') }
  };
  useEffect(() => { load() }, [code]);
  useEffect(() => {
    if (!joined) return;
    const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', { auth: { token: localStorage.getItem('st_token') } });
    setSocket(s);
    s.on('connect', () => s.emit('join-room', { roomCode: code }));
    s.on('sync-state', st => setSyncState(st));
    s.on('chat-message', m => setMessages(x => [...x, m]));
    s.on('user-joined', ({ user: u }) => setParticipants(x => x.some(a => a.id === u.id) ? x : [...x, u]));
    s.on('user-left', ({ userId }) => setParticipants(x => x.filter(a => a.id !== userId)));
    s.on('room-error', e => setError(e.message));
    s.on('host-transfer', () => load());
    return () => {
      s.disconnect();
    };
  }, [joined, code]);
  const isHost = room?.host_id === user.id;
  const join = async (password) => { try { await api.post(`/rooms/${code}/join`, { password }); setJoined(true); await load() } catch (err) { setError(err.response?.data?.message || 'Could not join') } };
  if (error && !room) return <Layout><div className="card p-8 text-center text-rose-300">{error}</div></Layout>;
  if (!room) return <Layout><div className="p-10 text-center">Loading room...</div></Layout>;
  if (!joined) return <Layout><JoinGate room={room} onJoined={join} /></Layout>;
  const playMedia = (id) => {
    const found = playlist.find(x => x.media_id === id);
    if (found) { setMedia({ id: found.media_id, title: found.title, url: found.url, thumbnail_url: found.thumbnail_url }); socket?.emit('change-video', { mediaId: id }) }
  };
  const add = async f => { try { const r = await api.post(`/rooms/${code}/playlist`, { ...f, duration: 0 }); setPlaylist(x => [...x, r.data.item]) } catch (e) { setError(e.response?.data?.message || 'Add failed') } };
  const remove = async id => { await api.delete(`/rooms/${code}/playlist/${id}`); setPlaylist(x => x.filter(a => a.id !== id)) };
  return <Layout>
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-2xl font-black">{room.name}</h1><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">● Connected</span></div><div className="text-sm text-slate-500">{code} · {participants.length}/{room.max_participants} participants</div></div>
      <button className="btn-secondary" onClick={() => { navigator.clipboard.writeText(`${location.origin}/rooms/${code}`); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? <CheckCircle2 size={17} /> : <Copy size={17} />} {copied ? 'Copied' : 'Invite'}</button>
      {isHost && <button className="btn-danger" onClick={async () => { if (confirm('Close this room?')) { await api.delete(`/rooms/${code}`); location.href = '/dashboard' } }}>Close Room</button>}
    </div>
    {error && <div className="mb-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Player media={media} socket={socket} isHost={isHost} syncState={syncState} />
        <div className="card p-4"><div className="mb-3 font-bold">Reactions</div><Reactions socket={socket} /></div>
        <div className="card p-4"><div className="mb-3 flex items-center gap-2 font-bold"><Users size={18} /> Participants</div><div className="flex flex-wrap gap-2">{participants.map(p => <div key={p.id} className="rounded-xl bg-white/5 px-3 py-2 text-sm">{p.username}{p.role === 'host' ? ' 👑' : ''}</div>)}</div></div>
      </div>
      <div className="space-y-4">
        <Playlist items={playlist} onPlay={playMedia} onAdd={add} onRemove={remove} isHost={isHost} />
        <ChatPanel socket={socket} messages={messages} setMessages={setMessages} />
      </div>
    </div>
  </Layout>;
}

function Profile() {
  const { user, setUser } = useAuth(); const [name, setName] = useState(user?.full_name || ''); const [bio, setBio] = useState(user?.bio || ''); const [saved, setSaved] = useState(false);
  return <Layout><div className="mx-auto max-w-2xl"><h1 className="text-3xl font-black">Profile</h1><p className="mb-6 text-slate-400">Manage your public profile.</p><form className="card space-y-4 p-6" onSubmit={async e => { e.preventDefault(); const r = await api.put(`/users/${user.id}`, { fullName: name, bio }); setUser(r.data.user); setSaved(true); setTimeout(() => setSaved(false), 1500) }}><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" /><input className="input" value={user.username} disabled /><input className="input" value={user.email} disabled /><textarea className="input min-h-32" value={bio} onChange={e => setBio(e.target.value)} placeholder="Bio" /><button className="btn-primary">Save changes</button>{saved && <span className="ml-3 text-sm text-emerald-300">Saved</span>}</form></div></Layout>;
}

function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
    <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
    <Route path="/rooms" element={<Protected><Rooms /></Protected>} />
    <Route path="/rooms/create" element={<Protected><CreateRoom /></Protected>} />
    <Route path="/rooms/:roomCode" element={<Protected><Room /></Protected>} />
    <Route path="/profile" element={<Protected><Profile /></Protected>} />
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></AuthProvider></BrowserRouter>;
}

export default App;
