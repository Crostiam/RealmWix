import { useState, useEffect, useRef } from 'react';
import { Shield, Send, Map, Swords, Crown, Beer, TreePine, LogOut, Scroll, Users, X, MessageSquare, Plus, Trash2, Book, Flame, Edit } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAM_rP5k7PAuBq8_Xkin23X9NYW5qolJsM",
  authDomain: "ludo-14af4.firebaseapp.com",
  databaseURL: "https://ludo-14af4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ludo-14af4",
  storageBucket: "ludo-14af4.firebasestorage.app",
  messagingSenderId: "1097419329945",
  appId: "1:1097419329945:web:87a5cff6d4bd43efea0308",
  measurementId: "G-GBCPNMB263"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'default-medieval-chat';

// --- Types ---
interface Profile {
  id: string;
  username: string;
  name: string;
  passphrase: string;
  role: string;
  charClass: string;
  avatar: string;
  bio: string;
}

interface Room {
  id: string;
  name: string;
  description: string;
  iconName: string;
  createdAt: number;
}

interface Message {
  id: string;
  roomId: string;
  sender: string;
  senderId: string;
  role: string;
  avatar: string;
  text: string;
  imageUrl?: string | null;
  type: string;
  timestamp: number;
  targetId?: string;
  targetName?: string;
}

interface PresenceUser {
  id: string;
  name: string;
  charClass: string;
  avatar: string;
  role: string;
  bio: string;
  currentRoom: string;
  lastActive: number;
}

interface Character {
  id: string;
  name: string;
  charClass: string;
  avatar: string;
  role: string;
  bio: string;
}

interface Notice {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  author: string;
}

// --- Constants ---
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  beer: Beer,
  swords: Swords,
  crown: Crown,
  treepine: TreePine,
  map: Map,
  shield: Shield,
  scroll: Scroll,
  book: Book,
  flame: Flame
};

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

const INITIAL_ROOMS = [
  { name: 'The Prancing Pony', iconName: 'beer', description: 'A lively tavern smelling of ale and roasted meats.' },
  { name: 'Castle Courtyard', iconName: 'swords', description: 'Knights spar while merchants peddle their wares.' },
  { name: 'The Throne Room', iconName: 'crown', description: 'The seat of power. Speak only when spoken to.' },
  { name: 'Whispering Woods', iconName: 'treepine', description: 'Dark, ancient, and full of secrets.' },
];

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";

const DEFAULT_PROFILE: Profile = {
  id: '', username: '', name: '', passphrase: '', role: 'player', charClass: '', avatar: DEFAULT_AVATAR, bio: ''
};

export default function MedievalChatApp() {
  const [user, setUser] = useState<import('firebase/auth').User | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'edit'>('login');
  const [authError, setAuthError] = useState('');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomIcon, setNewRoomIcon] = useState('map');

  const [characters, setCharacters] = useState<Character[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'realms' | 'roster' | 'board'>('realms');
  const [infoBoard, setInfoBoard] = useState<Notice[]>([]);
  const [isAddingNotice, setIsAddingNotice] = useState(false);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);

  const [interactUser, setInteractUser] = useState<PresenceUser | null>(null);
  const [whisperTarget, setWhisperTarget] = useState<PresenceUser | null>(null);

  const [roomEntryTime, setRoomEntryTime] = useState(Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (error) { console.warn("Auth error:", error); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const savedCharId = localStorage.getItem('medieval_char_id');
        if (savedCharId) {
          try {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'characters', savedCharId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data() as Omit<Profile, 'id'>;
              setProfile({ id: savedCharId, ...data } as Profile);
              setIsJoined(true);
            }
          } catch (e) { console.error("Error fetching saved profile:", e); }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isJoined) return;

    const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
    const unsubRooms = onSnapshot(roomsRef, (snapshot) => {
      const dbRooms = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Room[];
      dbRooms.sort((a, b) => a.createdAt - b.createdAt);
      setRooms(dbRooms);

      if (dbRooms.length === 0 && profile.role === 'admin') {
        const seedRooms = async () => {
          for (const r of INITIAL_ROOMS) {
            await addDoc(roomsRef, { ...r, createdAt: Date.now() });
          }
        };
        seedRooms();
      } else if (dbRooms.length > 0) {
        setActiveRoom(prev => {
          if (!prev || !dbRooms.find(r => r.id === prev)) return dbRooms[0].id;
          return prev;
        });
      }
    }, (error) => console.error("Error fetching rooms:", error));

    const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    const unsubMessages = onSnapshot(messagesRef, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Message[];
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(msgs);
    }, (error) => console.error("Error fetching messages:", error));

    const presenceRef = collection(db, 'artifacts', appId, 'public', 'data', 'presence');
    const unsubPresence = onSnapshot(presenceRef, (snapshot) => {
      const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PresenceUser[];
      setPresence(users);
    }, (error) => console.error("Error fetching presence:", error));

    const charsRef = collection(db, 'artifacts', appId, 'public', 'data', 'characters');
    const unsubChars = onSnapshot(charsRef, (snapshot) => {
      const chars = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Character[];
      setCharacters(chars);
    }, (error) => console.error("Error fetching characters:", error));

    const boardRef = collection(db, 'artifacts', appId, 'public', 'data', 'board');
    const unsubBoard = onSnapshot(boardRef, (snapshot) => {
      const notices = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Notice[];
      notices.sort((a, b) => b.timestamp - a.timestamp);
      setInfoBoard(notices);
    }, (error) => console.error("Error fetching board:", error));

    return () => { unsubRooms(); unsubMessages(); unsubPresence(); unsubChars(); unsubBoard(); };
  }, [user, isJoined, profile.role]);

  useEffect(() => {
    setRoomEntryTime(Date.now());
    if (user && isJoined && profile.id) {
      const updatePresence = async () => {
        try {
          const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'presence', profile.id);
          await setDoc(userDocRef, { currentRoom: activeRoom, lastActive: Date.now() }, { merge: true });
        } catch (e) { console.error("Error updating room presence:", e); }
      };
      updatePresence();
    }
  }, [activeRoom, user, isJoined, profile.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeRoom]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150, MAX_HEIGHT = 150;
        let width = img.width, height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setProfile(prev => ({ ...prev, avatar: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.username.trim() || !profile.name.trim() || !profile.passphrase.trim()) {
      setAuthError('Username, Display Name, and Secret Passphrase are required.');
      return;
    }
    const charId = profile.username.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'characters', charId);
    try {
      const docSnap = await getDoc(docRef);
      if (authMode === 'register' && docSnap.exists()) {
        setAuthError('That username is already known in the realm. Please log in, or choose a different one.');
        return;
      }
      const determinedRole = profile.username.toLowerCase() === 'test' ? 'admin' : profile.role || 'player';
      const finalProfile = { ...profile, id: charId, role: determinedRole };
      await setDoc(docRef, { ...finalProfile, lastSeen: Date.now() });
      localStorage.setItem('medieval_char_id', charId);
      setProfile(finalProfile);
      setIsJoined(true);
      setAuthError('');
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'presence', charId), {
        ...finalProfile, currentRoom: activeRoom, lastActive: Date.now()
      });
    } catch (err) {
      setAuthError("Failed to access the realm's records.");
      console.error(err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.username.trim() || !profile.passphrase.trim()) {
      setAuthError('Username and Secret Passphrase are required.');
      return;
    }
    const charId = profile.username.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'characters', charId);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const charData = docSnap.data() as Omit<Profile, 'id'>;
        if (charData.passphrase === profile.passphrase) {
          localStorage.setItem('medieval_char_id', charId);
          setProfile({ id: charId, username: profile.username, ...charData } as Profile);
          setIsJoined(true);
          setAuthError('');
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'presence', charId), {
            username: profile.username, ...charData, currentRoom: activeRoom, lastActive: Date.now()
          }, { merge: true });
        } else {
          setAuthError('Incorrect Secret Passphrase. The guards block your entry.');
        }
      } else {
        setAuthError('Character not found. Have you registered them?');
      }
    } catch (err) { setAuthError("Failed to access the realm's records."); }
  };

  const handleLogout = async () => {
    setIsJoined(false);
    setAuthMode('login');
    localStorage.removeItem('medieval_char_id');
    if (profile.id) {
      try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'presence', profile.id)); }
      catch (e) { console.error(e); }
    }
    setProfile(DEFAULT_PROFILE);
  };

  const handleDeleteCharacter = async (charId: string) => {
    if (profile.role !== 'admin') return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'characters', charId));
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'presence', charId));
    } catch (e) { console.error("Error deleting character:", e); }
  };

  const visibleMessages = messages.filter(msg => {
    if (msg.roomId !== activeRoom) return false;
    if (msg.type === 'whisper') {
      const isMyWhisper = msg.senderId === profile.id || msg.targetId === profile.id;
      const isAdmin = profile.role === 'admin';
      if (!isMyWhisper && !isAdmin) return false;
    }
    if (profile.role === 'admin') return true;
    return msg.timestamp >= roomEntryTime;
  });

  const usersInRoom = presence.filter(p => p.currentRoom === activeRoom);

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (!blob) break;
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500;
            let width = img.width, height = img.height;
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            setAttachedImage(dataUrl);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        break;
      }
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
    await addDoc(roomsRef, { name: newRoomName, description: newRoomDesc, iconName: newRoomIcon, createdAt: Date.now() });
    setIsCreatingRoom(false); setNewRoomName(''); setNewRoomDesc(''); setNewRoomIcon('map');
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomToDelete));
      if (activeRoom === roomToDelete) {
        setActiveRoom(rooms.find(r => r.id !== roomToDelete)?.id ?? null);
      }
      setRoomToDelete(null);
    } catch (err) { console.error(err); }
  };

  const handleAddNotice = async () => {
    if (!newNoticeContent.trim()) return;
    try {
      const boardRef = collection(db, 'artifacts', appId, 'public', 'data', 'board');
      await addDoc(boardRef, { title: newNoticeTitle || 'Public Notice', content: newNoticeContent, timestamp: Date.now(), author: profile.name });
      setIsAddingNotice(false); setNewNoticeTitle(''); setNewNoticeContent('');
    } catch (err) { console.error("Error saving board:", err); }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'board', noticeId)); }
    catch (err) { console.error(err); }
  };

  const sendMessage = async (text: string, type = 'chat', customTarget: PresenceUser | null = null) => {
    if (!user || !profile.id) return;
    const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    const payload: Partial<Message> = {
      roomId: activeRoom ?? undefined,
      sender: profile.name,
      senderId: profile.id,
      role: profile.role,
      avatar: profile.avatar,
      text,
      imageUrl: attachedImage,
      type,
      timestamp: Date.now()
    };
    if (type === 'whisper') {
      payload.targetId = customTarget?.id || whisperTarget?.id;
      payload.targetName = customTarget?.name || whisperTarget?.name;
    } else if (type === 'action') {
      payload.targetId = customTarget?.id;
      payload.targetName = customTarget?.name;
    }
    await addDoc(messagesRef, payload);
    setAttachedImage(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachedImage) return;
    if (whisperTarget) {
      await sendMessage(newMessage, 'whisper');
      setNewMessage(''); setWhisperTarget(null);
    } else {
      await sendMessage(newMessage, 'chat');
      setNewMessage('');
    }
  };

  const handleAction = async (actionType: string) => {
    if (!interactUser) return;
    let actionText = '';
    switch (actionType) {
      case 'bow': actionText = `bows deeply to ${interactUser.name}.`; break;
      case 'cheer': actionText = `raises a frothy tankard to ${interactUser.name}!`; break;
      case 'slap': actionText = `slaps ${interactUser.name} across the face! Have at thee!`; break;
      default: actionText = `looks at ${interactUser.name}.`;
    }
    await sendMessage(actionText, 'action', interactUser);
    setInteractUser(null);
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-stone-950 items-center justify-center text-amber-500 font-serif">
        <div className="text-xl flex flex-col items-center gap-4">
          <Shield className="w-12 h-12 animate-pulse" />
          Loading the Realm...
        </div>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="flex h-screen bg-stone-950 items-center justify-center font-serif text-stone-200 overflow-y-auto py-10">
        <div className="bg-stone-900 p-8 rounded-xl border border-stone-700 shadow-2xl max-w-2xl w-full my-auto">
          <div className="flex mb-8 border-b border-stone-700">
            <button onClick={() => { setAuthMode('login'); setAuthError(''); }}
              className={`flex-1 py-4 text-lg font-bold transition-colors uppercase tracking-widest ${authMode === 'login' ? 'text-amber-500 border-b-2 border-amber-500 bg-stone-800/30' : 'text-stone-500 hover:text-stone-300'}`}>
              Log In
            </button>
            <button onClick={() => { setAuthMode('register'); setAuthError(''); }}
              className={`flex-1 py-4 text-lg font-bold transition-colors uppercase tracking-widest ${authMode === 'register' ? 'text-amber-500 border-b-2 border-amber-500 bg-stone-800/30' : 'text-stone-500 hover:text-stone-300'}`}>
              Create Character
            </button>
          </div>

          <h1 className="text-3xl font-bold text-amber-500 text-center mb-6 uppercase tracking-widest flex items-center justify-center gap-3">
            <Swords className="w-8 h-8" />
            {authMode === 'login' ? 'Return to the Realm' : authMode === 'edit' ? 'Update Character' : 'Forge Your Legend'}
          </h1>

          {authError && (
            <div className="bg-red-950/50 border border-red-900/50 text-red-400 p-4 rounded-lg mb-6 text-center text-sm">{authError}</div>
          )}

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegisterOrEdit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-stone-400 mb-1">Account Username {authMode !== 'login' && '(Unique Login ID)'}</label>
                  <input type="text" value={profile.username} onChange={e => setProfile({ ...profile, username: e.target.value })}
                    placeholder="e.g. jondoe123" disabled={authMode === 'edit'}
                    className="w-full bg-stone-950 border border-stone-700 p-3 rounded-lg text-stone-200 focus:border-amber-500 outline-none" />
                </div>
                {(authMode === 'register' || authMode === 'edit') && (
                  <div>
                    <label className="block text-sm text-stone-400 mb-1">Character Display Name</label>
                    <input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}
                      placeholder="e.g. Sir Galahad"
                      className="w-full bg-stone-950 border border-stone-700 p-3 rounded-lg text-stone-200 focus:border-amber-500 outline-none" />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-stone-400 mb-1">Secret Passphrase</label>
                  <input type="password" value={profile.passphrase} onChange={e => setProfile({ ...profile, passphrase: e.target.value })}
                    placeholder="A secret word to secure your character"
                    className="w-full bg-stone-950 border border-stone-700 p-3 rounded-lg text-stone-200 focus:border-amber-500 outline-none" />
                </div>
                {(authMode === 'register' || authMode === 'edit') && (
                  <div>
                    <label className="block text-sm text-stone-400 mb-1">Class / Profession</label>
                    <input type="text" value={profile.charClass} onChange={e => setProfile({ ...profile, charClass: e.target.value })}
                      placeholder="e.g. Wanderer, Blacksmith..."
                      className="w-full bg-stone-950 border border-stone-700 p-3 rounded-lg text-stone-200 focus:border-amber-500 outline-none" />
                  </div>
                )}
              </div>

              {(authMode === 'register' || authMode === 'edit') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-stone-400 mb-1">Character Portrait</label>
                    <div className="flex items-center gap-4 bg-stone-950 p-3 rounded-lg border border-stone-700">
                      <img src={profile.avatar} alt="Avatar Preview" className="w-16 h-16 rounded-lg object-cover bg-stone-800 shadow-inner shrink-0" />
                      <input type="file" accept="image/*" onChange={handleImageUpload}
                        className="w-full text-sm text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-900 file:text-amber-100 hover:file:bg-amber-800 cursor-pointer" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-stone-400 mb-1">Short Biography</label>
                    <textarea value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })}
                      placeholder="Describe your character's origins or appearance..." rows={3}
                      className="w-full bg-stone-950 border border-stone-700 p-3 rounded-lg text-stone-200 focus:border-amber-500 outline-none resize-none"></textarea>
                  </div>
                </div>
              )}
            </div>

            <button type="submit"
              disabled={authMode === 'login' ? (!profile.username.trim() || !profile.passphrase.trim()) : (!profile.username.trim() || !profile.name.trim() || !profile.passphrase.trim())}
              className="w-full mt-8 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-amber-100 font-bold py-4 px-4 rounded-lg transition-colors shadow-lg text-lg tracking-wide uppercase">
              {authMode === 'login' ? 'Log In' : authMode === 'edit' ? 'Save Changes' : 'Enter the Realm'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-stone-950 text-stone-200 font-serif selection:bg-amber-900 selection:text-amber-100 overflow-hidden">

      {/* Left Sidebar */}
      <div className="w-64 md:w-72 bg-stone-900 border-r border-stone-700 flex flex-col relative z-10 shadow-2xl shrink-0 hidden md:flex">
        <div className="flex bg-stone-950/80 border-b border-stone-800 shrink-0">
          {(['realms', 'roster', 'board'] as const).map((tab, i) => {
            const icons = [Map, Users, Scroll];
            const Icon = icons[i];
            return (
              <button key={tab} onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-4 border-b-2 flex items-center justify-center transition-colors ${sidebarTab === tab ? 'border-amber-500 text-amber-500 bg-stone-900' : 'border-transparent text-stone-500 hover:text-stone-300 hover:bg-stone-900/50'}`}>
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto py-4 min-h-0">
          {sidebarTab === 'realms' && (
            <>
              {rooms.map(room => {
                const Icon = ICON_MAP[room.iconName] || Map;
                const isActive = activeRoom === room.id;
                return (
                  <div key={room.id} className="relative group">
                    <button onClick={() => setActiveRoom(room.id)}
                      className={`w-full text-left px-6 py-4 flex items-center gap-4 transition-all duration-300 border-l-4 ${isActive ? 'bg-stone-800 border-amber-500 text-amber-400 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]' : 'border-transparent text-stone-400 hover:bg-stone-800/50 hover:text-stone-300'}`}>
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-stone-900 shadow-inner' : ''}`}>
                        <Icon className={`w-5 h-5 ${isActive ? 'text-amber-500' : 'text-stone-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{room.name}</div>
                        <div className="text-xs opacity-70 mt-1 line-clamp-1">{room.description}</div>
                      </div>
                    </button>
                    {profile.role === 'admin' && (
                      <button onClick={(e) => { e.stopPropagation(); setRoomToDelete(room.id); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-stone-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all bg-stone-900 rounded-lg shadow-md" title="Destroy Realm">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              {profile.role === 'admin' && (
                <div className="px-6 mt-4">
                  <button onClick={() => setIsCreatingRoom(true)}
                    className="w-full py-3 flex items-center justify-center gap-2 border border-stone-700 border-dashed rounded-lg text-stone-400 hover:text-amber-400 hover:border-amber-700 hover:bg-amber-900/20 transition-all">
                    <Plus className="w-4 h-4" /> Add Room
                  </button>
                </div>
              )}
            </>
          )}

          {sidebarTab === 'roster' && (
            <div className="px-4 space-y-3">
              <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4 px-2">Known Travelers</h2>
              {characters.length === 0 ? (
                <div className="text-center text-stone-500 italic py-4">No travelers yet.</div>
              ) : characters.map(char => {
                const isOnline = presence.some(p => p.id === char.id);
                return (
                  <div key={char.id} className="flex items-center justify-between p-3 bg-stone-950/50 rounded-lg border border-stone-800 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img src={char.avatar} alt="avatar" className="w-10 h-10 rounded-md object-cover border border-stone-700 bg-stone-900" />
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-stone-950 ${isOnline ? 'bg-green-500' : 'bg-stone-600'}`}></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-stone-200 truncate flex items-center gap-1 text-sm">
                          {char.name}
                          {char.role === 'admin' && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                        </div>
                        <div className="text-xs text-stone-500 truncate">{char.charClass}</div>
                      </div>
                    </div>
                    {profile.role === 'admin' && char.id !== profile.id && (
                      <button onClick={() => handleDeleteCharacter(char.id)}
                        className="p-1.5 text-stone-600 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {sidebarTab === 'board' && (
            <div className="px-4 flex flex-col h-full">
              <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Notice Board</h2>
                {profile.role === 'admin' && !isAddingNotice && (
                  <button onClick={() => setIsAddingNotice(true)} className="text-amber-500 hover:text-amber-400 text-xs flex items-center gap-1 bg-amber-900/20 px-2 py-1 rounded border border-amber-900/50 transition-colors">
                    <Plus className="w-3 h-3" /> Add Notice
                  </button>
                )}
              </div>
              {isAddingNotice ? (
                <div className="flex flex-col flex-1 min-h-0 gap-3 pb-2">
                  <input type="text" value={newNoticeTitle} onChange={(e) => setNewNoticeTitle(e.target.value)}
                    placeholder="Notice Title..."
                    className="w-full bg-stone-950 border border-amber-900/50 p-3 rounded-lg text-stone-200 focus:border-amber-500 outline-none text-sm font-sans shadow-inner" />
                  <textarea value={newNoticeContent} onChange={(e) => setNewNoticeContent(e.target.value)}
                    className="flex-1 w-full bg-stone-950 border border-amber-900/50 p-4 rounded-lg text-stone-200 focus:border-amber-500 outline-none resize-none text-sm font-sans shadow-inner"
                    placeholder="Write notices for the realm..." />
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setIsAddingNotice(false)} className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-sm transition-colors border border-stone-600">Cancel</button>
                    <button onClick={handleAddNotice} className="flex-1 py-2.5 bg-amber-700 hover:bg-amber-600 text-amber-100 font-bold rounded-lg text-sm transition-colors shadow-lg">Post</button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
                  {infoBoard.length === 0 ? (
                    <div className="bg-stone-950 p-5 rounded-lg border border-stone-800 text-stone-500 text-sm italic text-center shadow-inner">The board is empty. No notices today.</div>
                  ) : infoBoard.map(notice => (
                    <div key={notice.id} className="bg-stone-950 p-4 rounded-lg border border-stone-800 relative group shadow-sm">
                      {profile.role === 'admin' && (
                        <button onClick={() => handleDeleteNotice(notice.id)}
                          className="absolute top-2 right-2 p-1.5 bg-stone-900 text-stone-600 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <h3 className="text-amber-500 font-bold text-sm mb-2 pr-6">{notice.title}</h3>
                      <div className="text-stone-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">{notice.content}</div>
                      <div className="text-stone-600 text-[10px] uppercase tracking-widest mt-4 flex justify-between items-center border-t border-stone-800 pt-2">
                        <span>By {notice.author}</span>
                        <span>{new Date(notice.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Current User Profile */}
        <div className="p-4 border-t border-stone-800 bg-stone-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={profile.avatar} alt="avatar" className="w-10 h-10 object-cover bg-stone-950 rounded-md border border-stone-800 shadow-inner shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-amber-100 truncate w-24 md:w-32">{profile.name}</div>
              <div className="text-xs text-stone-400 uppercase tracking-widest truncate">{profile.charClass}</div>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => { setIsJoined(false); setAuthMode('edit'); setAuthError(''); }}
              className="p-2 text-stone-500 hover:text-amber-400 transition-colors bg-stone-950 rounded-lg shadow-inner" title="Edit Profile">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={handleLogout}
              className="p-2 text-stone-500 hover:text-red-400 transition-colors bg-stone-950 rounded-lg shadow-inner" title="Leave Realm">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-stone-800 via-stone-900 to-stone-950 min-w-0">
        <header className="px-6 py-4 border-b border-stone-800 bg-stone-900/80 backdrop-blur-sm flex justify-between items-center shadow-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold text-amber-100 tracking-wide flex items-center gap-2 truncate">
                {rooms.find(r => r.id === activeRoom)?.name || "Select a Realm"}
              </h2>
              <p className="text-stone-400 text-xs md:text-sm mt-1 italic hidden sm:block truncate">
                {rooms.find(r => r.id === activeRoom)?.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="text-stone-400 flex items-center gap-2 text-sm bg-stone-950 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-stone-800">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{usersInRoom.length} present</span>
              <span className="sm:hidden">{usersInRoom.length}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {visibleMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-500 opacity-70">
              <Scroll className="w-16 h-16 mb-4 text-stone-700" />
              <p className="text-lg italic">{activeRoom ? "The room is quiet upon your arrival..." : "Awaiting the creation of realms..."}</p>
            </div>
          ) : visibleMessages.map((msg) => {
            const isMe = msg.senderId === profile.id;
            const isAdminMsg = msg.role === 'admin';

            if (msg.type === 'action') {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <span className="flex items-center text-amber-500/80 italic text-sm md:text-base px-6 py-2 bg-stone-950/50 rounded-full border border-stone-800 shadow-sm">
                    <img src={msg.avatar} className="w-6 h-6 rounded-full object-cover mr-2" alt="" />
                    <span><span className="font-bold">{msg.sender}</span> {msg.text}</span>
                  </span>
                </div>
              );
            }

            if (msg.type === 'whisper') {
              return (
                <div key={msg.id} className={`flex flex-col max-w-[85%] md:max-w-2xl ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                  <div className="flex items-baseline gap-2 mb-1 px-1 opacity-80">
                    <span className="text-sm mr-1">🤫</span>
                    <span className="text-sm font-bold text-fuchsia-400">
                      {isMe ? `You whispered to ${msg.targetName}` : `${msg.sender} whispers to you`}
                    </span>
                  </div>
                  <div className={`px-5 py-3 rounded-2xl shadow-lg relative bg-fuchsia-950/40 border border-fuchsia-800/50 text-fuchsia-100 italic ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
                    "{msg.text}"
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex flex-col max-w-[85%] md:max-w-2xl ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                <div className="flex items-baseline gap-2 mb-1 px-1">
                  {!isMe && <img src={msg.avatar} className="w-5 h-5 rounded-full object-cover mr-1" alt="" />}
                  <span className={`text-sm font-semibold flex items-center gap-1 ${isAdminMsg ? 'text-amber-500' : isMe ? 'text-blue-400' : 'text-stone-300'}`}>
                    {msg.sender}
                    {isAdminMsg && <Crown className="w-3 h-3" />}
                  </span>
                  <span className="text-xs text-stone-500 font-sans">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`px-5 py-3 rounded-2xl shadow-lg relative ${isAdminMsg ? 'bg-amber-900/40 border border-amber-700/50 text-amber-100 rounded-tl-none' : isMe ? 'bg-stone-700 border border-stone-600 text-stone-100 rounded-tr-none' : 'bg-stone-800 border border-stone-700 text-stone-200 rounded-tl-none'}`}>
                  {msg.text && <div>{msg.text}</div>}
                  {msg.imageUrl && <img src={msg.imageUrl} alt="attached" className="mt-2 max-w-full rounded-lg border border-stone-600/50 shadow-sm" />}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-stone-900 border-t border-stone-800 shrink-0">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex flex-col gap-2">
            {whisperTarget && (
              <div className="flex items-center gap-2 text-sm bg-fuchsia-950/50 text-fuchsia-300 px-4 py-2 rounded-lg border border-fuchsia-900/50 w-max self-start">
                <span>Whispering to <strong>{whisperTarget.name}</strong></span>
                <button type="button" onClick={() => setWhisperTarget(null)} className="ml-2 hover:text-fuchsia-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {attachedImage && (
              <div className="relative self-start mb-2 ml-2">
                <img src={attachedImage} alt="attached preview" className="h-24 w-auto rounded-lg border-2 border-stone-700 shadow-md object-contain bg-stone-950" />
                <button type="button" onClick={() => setAttachedImage(null)} className="absolute -top-3 -right-3 bg-stone-900 border border-stone-600 rounded-full p-1.5 text-stone-400 hover:text-white hover:bg-red-900 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="relative flex items-center w-full">
              <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onPaste={handlePaste}
                placeholder={whisperTarget ? `Secretly tell ${whisperTarget.name}...` : `Speak in ${rooms.find(r => r.id === activeRoom)?.name || 'the realm'}... (Ctrl+V to paste image)`}
                className={`w-full bg-stone-950 border text-stone-200 py-4 pl-6 pr-16 rounded-xl outline-none transition-all shadow-inner ${whisperTarget ? 'border-fuchsia-800 placeholder-fuchsia-800/50 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50' : 'border-stone-700 placeholder-stone-600 focus:border-amber-600 focus:ring-1 focus:ring-amber-600/50'}`} />
              <button type="submit" disabled={(!newMessage.trim() && !attachedImage) || !activeRoom}
                className={`absolute right-2 p-3 rounded-lg transition-colors flex items-center justify-center shadow-md disabled:shadow-none ${whisperTarget ? 'bg-fuchsia-800 hover:bg-fuchsia-700 disabled:bg-stone-800 disabled:text-stone-600 text-fuchsia-100' : 'bg-amber-700 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-600 text-amber-100'}`}>
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-64 bg-stone-900 border-l border-stone-800 flex flex-col relative z-10 shadow-xl shrink-0 hidden lg:flex">
        <div className="p-4 border-b border-stone-800 bg-stone-950/50">
          <h2 className="text-sm font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4" /> In this Room
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {usersInRoom.map(p => (
            <button key={p.id} onClick={() => p.id !== profile.id && setInteractUser(p)} disabled={p.id === profile.id}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors border border-transparent ${p.id === profile.id ? 'opacity-50 cursor-default' : 'hover:bg-stone-800 hover:border-stone-700 cursor-pointer'}`}>
              <img src={p.avatar} alt="avatar" className="w-8 h-8 rounded-md object-cover bg-stone-950 border border-stone-800 shadow-inner shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-stone-200 truncate">{p.name}</div>
                <div className="text-xs text-stone-500 truncate">{p.charClass}</div>
              </div>
            </button>
          ))}
          {usersInRoom.length === 0 && <div className="text-stone-600 text-sm italic text-center mt-10">It is lonely here...</div>}
        </div>
      </div>

      {/* Interact Modal */}
      {interactUser && (
        <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl max-w-sm w-full relative overflow-hidden">
            <div className="h-24 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-stone-700 via-stone-800 to-stone-900 flex items-end justify-center pb-4 relative">
              <button onClick={() => setInteractUser(null)} className="absolute top-4 right-4 text-stone-400 hover:text-white"><X className="w-5 h-5" /></button>
              <div className="absolute -bottom-8 w-20 h-20 bg-stone-950 p-1 rounded-full border-4 border-stone-900 shadow-xl">
                <img src={interactUser.avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
              </div>
            </div>
            <div className="pt-12 pb-6 px-6 text-center space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-amber-500">{interactUser.name}</h3>
                <p className="text-stone-400 text-sm uppercase tracking-wider flex items-center justify-center gap-2">
                  {interactUser.charClass}
                  {interactUser.role === 'admin' && <Crown className="w-4 h-4 text-amber-500" />}
                </p>
              </div>
              {interactUser.bio && (
                <div className="bg-stone-950/50 p-4 rounded-lg border border-stone-800 text-sm text-stone-300 italic">"{interactUser.bio}"</div>
              )}
              <div className="pt-4 space-y-2 border-t border-stone-800">
                <button onClick={() => { setWhisperTarget(interactUser); setInteractUser(null); }}
                  className="w-full flex items-center justify-center gap-2 bg-fuchsia-900/50 hover:bg-fuchsia-800/50 text-fuchsia-300 border border-fuchsia-900/50 py-2 rounded-lg transition-colors">
                  <MessageSquare className="w-4 h-4" /> Whisper Privately
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => handleAction('bow')} className="bg-stone-800 hover:bg-stone-700 text-stone-300 py-2 rounded-lg text-sm transition-colors border border-stone-700 shadow-sm">Bow</button>
                  <button onClick={() => handleAction('cheer')} className="bg-stone-800 hover:bg-stone-700 text-stone-300 py-2 rounded-lg text-sm transition-colors border border-stone-700 shadow-sm">Cheer</button>
                  <button onClick={() => handleAction('slap')} className="bg-red-900/30 hover:bg-red-900/50 text-red-400 py-2 rounded-lg text-sm transition-colors border border-red-900/50 shadow-sm">Slap</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Creation Modal */}
      {isCreatingRoom && (
        <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden">
            <h3 className="text-2xl font-bold text-amber-500 mb-4 flex items-center gap-2"><Plus className="w-6 h-6" /> Forge New Realm</h3>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm text-stone-400 mb-1">Room Name</label>
                <input type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 p-3 rounded-lg text-stone-200 focus:border-amber-500 outline-none"
                  placeholder="e.g. The Dungeon" autoFocus />
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1">Description</label>
                <textarea value={newRoomDesc} onChange={e => setNewRoomDesc(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 p-3 rounded-lg text-stone-200 focus:border-amber-500 outline-none resize-none"
                  placeholder="e.g. A damp and terrifying place..." rows={3} />
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-2">Room Icon</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_ICONS.map(iconName => {
                    const IconComp = ICON_MAP[iconName];
                    return (
                      <button key={iconName} type="button" onClick={() => setNewRoomIcon(iconName)}
                        className={`p-3 rounded-lg border transition-all ${newRoomIcon === iconName ? 'bg-amber-900/50 border-amber-500 text-amber-400 shadow-inner' : 'bg-stone-950 border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-500'}`}>
                        <IconComp className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-stone-800">
                <button type="button" onClick={() => setIsCreatingRoom(false)} className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg transition-colors border border-stone-600">Cancel</button>
                <button type="submit" disabled={!newRoomName.trim()} className="flex-1 py-3 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-100 font-bold rounded-lg transition-colors shadow-lg">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Deletion Modal */}
      {roomToDelete && (
        <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-red-900/50 rounded-xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden">
            <h3 className="text-2xl font-bold text-red-500 mb-2 flex items-center gap-2"><Flame className="w-6 h-6" /> Destroy Realm?</h3>
            <p className="text-stone-300 mb-6 text-sm">
              Are you sure you want to completely erase <strong className="text-amber-500">{rooms.find(r => r.id === roomToDelete)?.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-2 border-t border-stone-800">
              <button onClick={() => setRoomToDelete(null)} className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg transition-colors border border-stone-600">Spare It</button>
              <button onClick={confirmDeleteRoom} className="flex-1 py-3 bg-red-900/80 hover:bg-red-800 text-red-100 font-bold rounded-lg transition-colors shadow-lg border border-red-700">Destroy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}