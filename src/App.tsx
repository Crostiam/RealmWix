import React, { useState, useEffect, useRef } from 'react';
import { Shield, Send, Map, Swords, Crown, Beer, TreePine, LogOut, Scroll, Users, X, MessageSquare, Plus, Trash2, Book, Flame, Edit, Mail, ZoomIn, ZoomOut, Maximize, Move, Clock, Feather } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import type { LucideIcon } from 'lucide-react';

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
  imageUrl?: string | null;
  timestamp: number;
  author: string;
  authorId?: string;
  x?: number;
  y?: number;
  zIndex?: number;
}

interface MailMessage {
  id: string;
  senderId: string;
  senderName: string;
  targetId: string;
  targetName: string;
  content: string;
  timestamp: number;
}

// --- Constants ---
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
  const [sidebarTab, setSidebarTab] = useState<'realms' | 'roster' | 'board' | 'mail'>('realms');
  
  // Board System State
  const [infoBoard, setInfoBoard] = useState<Notice[]>([]);
  const [isAddingNotice, setIsAddingNotice] = useState(false);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');
  const [attachedNoticeImage, setAttachedNoticeImage] = useState<string | null>(null);
  
  // Infinite Canvas State
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardTransform, setBoardTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedNotice, setDraggedNotice] = useState<{ id: string, startX: number, startY: number, mouseX: number, mouseY: number } | null>(null);
  
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [interactUser, setInteractUser] = useState<PresenceUser | null>(null);
  const [whisperTarget, setWhisperTarget] = useState<PresenceUser | null>(null);
  const [roomEntryTime, setRoomEntryTime] = useState(Date.now());

  // Mail System State
  const [mails, setMails] = useState<MailMessage[]>([]);
  const [activeMailTarget, setActiveMailTarget] = useState<Character | {id: string, name: string} | null>(null);
  const [mailContent, setMailContent] = useState('');
  const [mailCooldown, setMailCooldown] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (error) { console.warn("Auth error:", error); }
    };
    initAuth();

    const checkCooldown = () => {
      const lastSent = parseInt(localStorage.getItem('medieval_last_mail_time') || '0');
      const now = Date.now();
      const elapsed = Math.floor((now - lastSent) / 1000);
      if (elapsed < 60) {
        setMailCooldown(60 - Math.max(0, elapsed));
      } else {
        setMailCooldown(0);
      }
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);

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
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
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
          if (!prev || (!dbRooms.find(r => r.id === prev) && prev !== 'board' && prev !== 'mail' && prev !== 'main-town')) return 'main-town';
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
      // Keep sort stable by timestamp
      notices.sort((a, b) => a.timestamp - b.timestamp);
      
      // Merge optimistic dragging state with DB state to prevent jitter
      setInfoBoard(prev => {
        if (!draggedNotice) return notices;
        return notices.map(n => {
           if (n.id === draggedNotice.id) {
              const localNotice = prev.find(p => p.id === n.id);
              return localNotice ? { ...n, x: localNotice.x, y: localNotice.y } : n;
           }
           return n;
        });
      });
      if(!draggedNotice) setInfoBoard(notices);
      
    }, (error) => console.error("Error fetching board:", error));

    const mailRef = collection(db, 'artifacts', appId, 'public', 'data', 'mail');
    const unsubMail = onSnapshot(mailRef, (snapshot) => {
      const dbMails = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MailMessage[];
      dbMails.sort((a, b) => a.timestamp - b.timestamp); // Sort oldest first for chat flow
      setMails(dbMails);
    }, (error) => console.error("Error fetching mail:", error));

    return () => { unsubRooms(); unsubMessages(); unsubPresence(); unsubChars(); unsubBoard(); unsubMail(); };
  }, [user, isJoined, profile.role, draggedNotice]);

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
      
      // Center board on entry
      if (activeRoom === 'board') {
         setBoardTransform({ x: window.innerWidth / 3, y: 100, scale: 1 });
      }
    }
  }, [activeRoom, user, isJoined, profile.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mails, activeRoom, activeMailTarget]);

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
          setProfile({ id: charId, ...charData, username: profile.username } as Profile);
          setIsJoined(true);
          setAuthError('');

          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'presence', charId), {
            ...charData, username: profile.username, currentRoom: activeRoom, lastActive: Date.now()
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

  // Zoom on wheel scroll
  const handleBoardWheel = (e: React.WheelEvent) => {
    if (activeRoom !== 'board') return;
    
    const scaleChange = e.deltaY * -0.001;
    let newScale = boardTransform.scale + scaleChange;
    // Clamp zoom levels
    newScale = Math.min(Math.max(0.15, newScale), 3);
    
    const ratio = newScale / boardTransform.scale;
    
    // Zoom exactly where the mouse pointer is
    if (boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      
      setBoardTransform(prev => ({
        scale: newScale,
        x: pointerX - (pointerX - prev.x) * ratio,
        y: pointerY - (pointerY - prev.y) * ratio
      }));
    }
  };

  // Generic pointer handlers for Panning the Board OR Dragging a Notice
  const handleBoardPointerDown = (e: React.PointerEvent) => {
    // Only pan if we aren't dragging a notice
    if (!draggedNotice) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - boardTransform.x, y: e.clientY - boardTransform.y });
      // Capture pointer so dragging outside the window still works
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleNoticePointerDown = (e: React.PointerEvent, notice: Notice) => {
    if (profile.role !== 'admin' && notice.authorId !== profile.id) return; // Only admins and authors can move notices
    e.stopPropagation(); // Don't trigger board pan
    
    // Capture pointer on the notice element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    setDraggedNotice({
      id: notice.id,
      startX: notice.x || 0,
      startY: notice.y || 0,
      mouseX: e.clientX,
      mouseY: e.clientY
    });
  };

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (draggedNotice) {
      // We are dragging a notice
      const dx = (e.clientX - draggedNotice.mouseX) / boardTransform.scale;
      const dy = (e.clientY - draggedNotice.mouseY) / boardTransform.scale;
      
      // Update local state optimistically
      setInfoBoard(prev => prev.map(n => 
        n.id === draggedNotice.id 
          ? { ...n, x: draggedNotice.startX + dx, y: draggedNotice.startY + dy }
          : n
      ));
    } else if (isPanning) {
      // We are panning the board
      setBoardTransform(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }));
    }
  };

  const handleGlobalPointerUp = async (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    
    if (draggedNotice) {
      const noticeToSave = infoBoard.find(n => n.id === draggedNotice.id);
      if (noticeToSave) {
        // Save new coordinates to Firebase
        try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'board', noticeToSave.id);
          await updateDoc(docRef, { x: noticeToSave.x, y: noticeToSave.y });
        } catch (err) {
          console.error("Failed to save notice position", err);
        }
      }
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setDraggedNotice(null);
    }
  };

  // Zoom controls
  const handleZoomIn = () => setBoardTransform(p => ({ ...p, scale: Math.min(p.scale + 0.2, 3) }));
  const handleZoomOut = () => setBoardTransform(p => ({ ...p, scale: Math.max(p.scale - 0.2, 0.15) }));
  const handleResetView = () => setBoardTransform({ x: window.innerWidth / 3, y: 100, scale: 1 });

  const handleNoticeImagePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
            const MAX_WIDTH = 800; // Larger resolution for board notices
            let width = img.width, height = img.height;

            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setAttachedNoticeImage(dataUrl);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        break;
      }
    }
  };

  const handleAddNotice = async () => {
    if (!newNoticeContent.trim() && !attachedNoticeImage) return;
    try {
      const boardRef = collection(db, 'artifacts', appId, 'public', 'data', 'board');
      
      // Calculate center of screen relative to current transform
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;
      const initialX = (screenCenterX - boardTransform.x) / boardTransform.scale;
      const initialY = (screenCenterY - boardTransform.y) / boardTransform.scale;

      await addDoc(boardRef, { 
        title: newNoticeTitle || 'Public Decree', 
        content: newNoticeContent, 
        imageUrl: attachedNoticeImage,
        timestamp: Date.now(), 
        author: profile.name,
        authorId: profile.id,
        x: initialX,
        y: initialY
      });
      setIsAddingNotice(false); setNewNoticeTitle(''); setNewNoticeContent(''); setAttachedNoticeImage(null);
    } catch (err) { console.error("Error saving board:", err); }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'board', noticeId)); }
    catch (err) { console.error(err); }
  };

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMailTarget || !mailContent.trim() || activeMailTarget.id === 'ALL') return;

    const lastSent = parseInt(localStorage.getItem('medieval_last_mail_time') || '0');
    const now = Date.now();
    
    // 1-minute cooldown, bypassed for admins
    if (now - lastSent < 60000 && profile.role !== 'admin') {
      return; // UI handles blocking now
    }

    try {
      const mailRef = collection(db, 'artifacts', appId, 'public', 'data', 'mail');
      await addDoc(mailRef, {
        senderId: profile.id,
        senderName: profile.name,
        targetId: activeMailTarget.id,
        targetName: activeMailTarget.name,
        content: mailContent,
        timestamp: now
      });
      
      localStorage.setItem('medieval_last_mail_time', now.toString());
      setMailContent('');
      setMailCooldown(60);
    } catch (err) {
      console.error("Error sending mail:", err);
    }
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
          {(['realms', 'roster', 'mail'] as const).map((tab, i) => {
            const icons = [Map, Users, Mail];
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
              <div className="relative group mb-2 border-b border-stone-800 pb-2">
                <button onClick={() => setActiveRoom('board')}
                  className={`w-full text-left px-6 py-4 flex items-center gap-4 transition-all duration-300 border-l-4 ${activeRoom === 'board' ? 'bg-stone-800 border-amber-500 text-amber-400 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]' : 'border-transparent text-stone-400 hover:bg-stone-800/50 hover:text-stone-300'}`}>
                  <div className={`p-2 rounded-lg ${activeRoom === 'board' ? 'bg-stone-900 shadow-inner' : ''}`}>
                    <Scroll className={`w-5 h-5 ${activeRoom === 'board' ? 'text-amber-500' : 'text-stone-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate uppercase tracking-wider text-sm text-amber-500">Notice Board</div>
                    <div className="text-xs opacity-70 mt-1 line-clamp-1">Infinite canvas of decrees</div>
                  </div>
                </button>
                
                <button onClick={() => setActiveRoom('main-town')}
                  className={`w-full text-left px-6 py-4 flex items-center gap-4 transition-all duration-300 border-l-4 ${activeRoom === 'main-town' ? 'bg-stone-800 border-amber-500 text-amber-400 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]' : 'border-transparent text-stone-400 hover:bg-stone-800/50 hover:text-stone-300'}`}>
                  <div className={`p-2 rounded-lg ${activeRoom === 'main-town' ? 'bg-stone-900 shadow-inner' : ''}`}>
                    <Map className={`w-5 h-5 ${activeRoom === 'main-town' ? 'text-amber-500' : 'text-stone-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate uppercase tracking-wider text-sm text-amber-500">Main Town</div>
                    <div className="text-xs opacity-70 mt-1 line-clamp-1">Global chat for all travelers</div>
                  </div>
                </button>
              </div>
              
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

          {sidebarTab === 'mail' && (
            <div className="px-4 flex flex-col h-full">
              <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest">Ravens (Mail)</h2>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pb-4 pr-1">
                {profile.role === 'admin' && (
                  <button 
                    onClick={() => { setActiveRoom('mail'); setActiveMailTarget({ id: 'ALL', name: 'Intercepted Ravens (Master View)' }); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors border ${activeRoom === 'mail' && activeMailTarget?.id === 'ALL' ? 'bg-amber-900/40 border-amber-500/50 text-amber-300' : 'bg-stone-950/50 border-stone-800 text-stone-400 hover:bg-stone-800'}`}
                  >
                    <div className="p-2 bg-stone-900 rounded-lg shadow-inner"><Feather className="w-4 h-4 text-amber-500" /></div>
                    <div className="font-bold text-sm truncate">Master View</div>
                  </button>
                )}
                
                {characters.filter(c => c.id !== profile.id).map(char => {
                  const isActiveMail = activeRoom === 'mail' && activeMailTarget?.id === char.id;
                  return (
                    <button 
                      key={char.id} 
                      onClick={() => { setActiveRoom('mail'); setActiveMailTarget(char); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors border ${isActiveMail ? 'bg-stone-800 border-indigo-500/50 text-indigo-300 shadow-inner' : 'bg-stone-950/50 border-stone-800 text-stone-300 hover:bg-stone-800'}`}
                    >
                      <img src={char.avatar} alt="avatar" className="w-8 h-8 rounded-md object-cover bg-stone-900 border border-stone-700 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm truncate">{char.name}</div>
                        <div className="text-[10px] text-stone-500 uppercase tracking-widest truncate">Send Raven</div>
                      </div>
                    </button>
                  );
                })}
                
                {characters.length <= 1 && (
                  <div className="text-center text-stone-600 italic mt-6 text-sm">No other travelers to write to.</div>
                )}
              </div>
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

      {}
      {activeRoom === 'board' ? (
        <div className="flex-1 flex flex-col relative bg-stone-950 min-w-0 overflow-hidden select-none">
          {/* Zoom Controls */}
          <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2 bg-stone-900/90 p-2 rounded-xl border border-stone-700 shadow-2xl backdrop-blur-sm">
             <button onClick={handleZoomIn} className="p-2 text-stone-400 hover:text-amber-400 hover:bg-stone-800 rounded-lg transition-colors" title="Zoom In"><ZoomIn className="w-5 h-5"/></button>
             <button onClick={handleResetView} className="p-2 text-stone-400 hover:text-amber-400 hover:bg-stone-800 rounded-lg transition-colors" title="Reset View"><Maximize className="w-5 h-5"/></button>
             <button onClick={handleZoomOut} className="p-2 text-stone-400 hover:text-amber-400 hover:bg-stone-800 rounded-lg transition-colors" title="Zoom Out"><ZoomOut className="w-5 h-5"/></button>
          </div>

          <header className="absolute top-0 left-0 right-0 px-6 py-4 border-b border-stone-800 bg-stone-900/80 backdrop-blur-sm flex justify-between items-center shadow-md z-20">
            <div className="min-w-0 flex items-center gap-4">
              <div className="p-2 bg-stone-950 rounded-lg shadow-inner">
                <Scroll className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-amber-500 tracking-wide flex items-center gap-2 truncate uppercase">
                  Town Square Notice Board
                </h2>
                <p className="text-stone-400 text-xs md:text-sm mt-1 italic truncate flex items-center gap-2">
                  <Move className="w-3 h-3" /> Click and drag the background to pan around.
                </p>
              </div>
            </div>
            <button onClick={() => setIsAddingNotice(true)} className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-100 px-4 py-2 rounded-lg transition-colors text-sm font-bold shadow-md shrink-0">
              <Plus className="w-4 h-4" /> Post Notice
            </button>
          </header>
          
          {/* Infinite Canvas Viewport */}
          <div 
            ref={boardRef}
            className={`flex-1 w-full h-full relative overflow-hidden bg-[#2a2421] ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onPointerDown={handleBoardPointerDown}
            onPointerMove={handleGlobalPointerMove}
            onPointerUp={handleGlobalPointerUp}
            onPointerLeave={handleGlobalPointerUp}
            onWheel={handleBoardWheel}
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c13.866 0 25.362 10.24 26.58 24h-1.08c-1.1-13.255-12.022-23-25.5-23V18zm0 11c7.732 0 14.28 6.046 14.956 14h-1.036c-.6-7.46-6.756-13-13.92-13V29zm0 10c2.21 0 4 1.79 4 4h-1c0-1.657-1.343-3-3-3v-1zm10-40c16.568 0 30 13.432 30 30h-1c0-15.932-12.91-28.85-28.85-28.85V-1zm-10 0c22.09 0 40 17.91 40 40h-1c0-21.54-17.46-39-39-39V-1z\' fill=\'%233a322c\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
            }}
          >
             {/* Transform Container */}
             <div 
                className="absolute origin-top-left will-change-transform"
                style={{ transform: `translate(${boardTransform.x}px, ${boardTransform.y}px) scale(${boardTransform.scale})` }}
             >
                {infoBoard.map(notice => {
                  const isDraggingThis = draggedNotice?.id === notice.id;
                  const canEdit = profile.role === 'admin' || notice.authorId === profile.id;
                  
                  return (
                    <div 
                      key={notice.id} 
                      onPointerDown={(e) => handleNoticePointerDown(e, notice)}
                      className={`absolute w-80 bg-[#fdf5e6] text-stone-900 p-6 shadow-2xl border border-[#d4c4a8] ${canEdit ? (isDraggingThis ? 'cursor-grabbing scale-105 z-50' : 'cursor-grab hover:-translate-y-1 z-10 hover:z-30') : 'z-10'} transition-transform duration-150 group`}
                      style={{ 
                         left: notice.x || 0, 
                         top: notice.y || 0,
                         transformOrigin: 'center',
                      }}
                    >
                       <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-800 shadow-[0_2px_4px_rgba(0,0,0,0.5)] border border-red-950 z-20 pointer-events-none">
                          <div className="absolute top-1 left-1 w-1 h-1 bg-white/40 rounded-full"></div>
                       </div>
                       
                       {canEdit && (
                          <button 
                            onPointerDown={(e) => e.stopPropagation()} // prevent dragging when clicking delete
                            onClick={() => handleDeleteNotice(notice.id)} 
                            className="absolute top-2 right-2 text-stone-500 hover:text-red-600 p-1.5 hover:bg-stone-200/50 rounded-full transition-colors z-20 opacity-0 group-hover:opacity-100"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                       )}
                       
                       <h3 className="font-bold text-xl mb-3 text-stone-800 font-serif border-b border-stone-300 pb-2 pointer-events-none">{notice.title}</h3>
                       
                       {notice.imageUrl && (
                          <img src={notice.imageUrl} className="w-full h-auto mb-4 rounded shadow-sm border border-stone-300 pointer-events-none" draggable="false" alt="Notice Attachment" />
                       )}
                       
                       <div className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-stone-800 mb-6 pointer-events-none">{notice.content}</div>
                       
                       <div className="mt-auto pt-3 border-t border-stone-300 text-[10px] uppercase tracking-widest text-stone-500 flex justify-between items-center font-sans pointer-events-none">
                          <span>Signed, {notice.author}</span>
                          <span>{new Date(notice.timestamp).toLocaleDateString()}</span>
                       </div>
                    </div>
                  );
                })}
             </div>
          </div>
        </div>
      ) : activeRoom === 'mail' ? (
        <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-stone-900 via-stone-950 to-black min-w-0">
          <header className="px-6 py-4 border-b border-stone-800 bg-stone-950/80 backdrop-blur-sm flex justify-between items-center shadow-md z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-stone-900 rounded-lg shadow-inner shrink-0">
                <Feather className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-bold text-indigo-300 tracking-wide flex items-center gap-2 truncate">
                  {activeMailTarget ? (activeMailTarget.id === 'ALL' ? 'Intercepted Ravens' : `Ravens with ${activeMailTarget.name}`) : "Raven Messenger"}
                </h2>
                <p className="text-stone-500 text-xs md:text-sm mt-1 italic truncate">
                  {activeMailTarget?.id === 'ALL' ? "Master view of all realm secrets." : "Private letters delivered by bird. 1 minute cooldown."}
                </p>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            {!activeMailTarget ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-600 opacity-70">
                <Feather className="w-16 h-16 mb-4 text-stone-700" />
                <p className="text-lg italic">Select a traveler from the roster to send a raven...</p>
              </div>
            ) : (
              (() => {
                const dmMessages = activeMailTarget.id === 'ALL' 
                  ? mails 
                  : mails.filter(m => 
                      (m.senderId === profile.id && m.targetId === activeMailTarget.id) || 
                      (m.senderId === activeMailTarget.id && m.targetId === profile.id)
                    );
                
                if (dmMessages.length === 0) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-stone-600 opacity-70">
                      <p className="text-lg italic">No ravens have flown between you two yet.</p>
                    </div>
                  );
                }

                return dmMessages.map(msg => {
                  const isMe = msg.senderId === profile.id;
                  const showTarget = activeMailTarget.id === 'ALL';
                  
                  return (
                    <div key={msg.id} className={`flex flex-col max-w-[85%] md:max-w-2xl ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                      <div className="flex items-baseline gap-2 mb-1 px-1">
                        <span className={`text-sm font-semibold flex items-center gap-1 ${isMe ? 'text-indigo-400' : 'text-stone-400'}`}>
                          {msg.senderName} {showTarget && <span className="text-stone-600 mx-1">→</span>} {showTarget && msg.targetName}
                        </span>
                        <span className="text-xs text-stone-600 font-sans">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`px-5 py-3 rounded-2xl shadow-lg relative font-serif italic ${isMe ? 'bg-indigo-950/40 border border-indigo-800/50 text-indigo-100 rounded-tr-none' : 'bg-stone-900 border border-stone-700 text-stone-300 rounded-tl-none'}`}>
                        "{msg.content}"
                      </div>
                    </div>
                  );
                });
              })()
            )}
            <div ref={messagesEndRef} />
          </div>

          {activeMailTarget && activeMailTarget.id !== 'ALL' && (
            <div className="p-4 md:p-6 bg-stone-950 border-t border-stone-800 shrink-0">
              {mailCooldown > 0 && profile.role !== 'admin' ? (
                <div className="max-w-4xl mx-auto w-full bg-red-950/40 border border-red-900/50 text-red-300 py-4 px-6 rounded-xl flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 animate-pulse text-red-500" />
                    <span className="font-bold tracking-wide text-sm md:text-base">The ravens are resting...</span>
                  </div>
                  <span className="text-xl font-mono font-bold bg-red-900/50 px-3 py-1 rounded-lg">{mailCooldown}s</span>
                </div>
              ) : (
                <form onSubmit={handleSendMail} className="max-w-4xl mx-auto relative flex items-center w-full">
                  <input type="text" value={mailContent} onChange={(e) => setMailContent(e.target.value)}
                    placeholder={`Pen a letter to ${activeMailTarget.name}...`}
                    className="w-full bg-stone-900 border border-indigo-900/50 text-stone-200 py-4 pl-6 pr-16 rounded-xl outline-none transition-all shadow-inner placeholder-stone-600 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600/50" />
                  <button type="submit" disabled={!mailContent.trim()}
                    className="absolute right-2 p-3 rounded-lg transition-colors flex items-center justify-center shadow-md bg-indigo-700 hover:bg-indigo-600 disabled:bg-stone-800 disabled:text-stone-600 text-indigo-100 disabled:shadow-none">
                    <Feather className="w-5 h-5" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-stone-800 via-stone-900 to-stone-950 min-w-0">
          <header className="px-6 py-4 border-b border-stone-800 bg-stone-900/80 backdrop-blur-sm flex justify-between items-center shadow-md z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-bold text-amber-100 tracking-wide flex items-center gap-2 truncate">
                  {activeRoom === 'main-town' ? 'Main Town' : rooms.find(r => r.id === activeRoom)?.name || "Select a Realm"}
                </h2>
                <p className="text-stone-400 text-xs md:text-sm mt-1 italic hidden sm:block truncate">
                  {activeRoom === 'main-town' ? 'The bustling center of the realm where all travelers gather.' : rooms.find(r => r.id === activeRoom)?.description}
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
                  placeholder={whisperTarget ? `Secretly tell ${whisperTarget.name}...` : `Speak in ${activeRoom === 'main-town' ? 'Main Town' : rooms.find(r => r.id === activeRoom)?.name || 'the realm'}... (Ctrl+V to paste image)`}
                  className={`w-full bg-stone-950 border text-stone-200 py-4 pl-6 pr-16 rounded-xl outline-none transition-all shadow-inner ${whisperTarget ? 'border-fuchsia-800 placeholder-fuchsia-800/50 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50' : 'border-stone-700 placeholder-stone-600 focus:border-amber-600 focus:ring-1 focus:ring-amber-600/50'}`} />
                <button type="submit" disabled={(!newMessage.trim() && !attachedImage) || !activeRoom}
                  className={`absolute right-2 p-3 rounded-lg transition-colors flex items-center justify-center shadow-md disabled:shadow-none ${whisperTarget ? 'bg-fuchsia-800 hover:bg-fuchsia-700 disabled:bg-stone-800 disabled:text-stone-600 text-fuchsia-100' : 'bg-amber-700 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-600 text-amber-100'}`}>
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
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

      {/* Notice Board Creation Modal */}
      {isAddingNotice && activeRoom === 'board' && (
        <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl max-w-lg w-full p-6 relative flex flex-col max-h-[90vh]">
             <button onClick={() => { setIsAddingNotice(false); setAttachedNoticeImage(null); }} className="absolute top-4 right-4 text-stone-400 hover:text-white"><X className="w-5 h-5" /></button>
             <h3 className="text-2xl font-bold text-amber-500 mb-6 flex items-center gap-2 border-b border-stone-800 pb-4"><Scroll className="w-6 h-6" /> Post Public Decree</h3>
             
             <div className="space-y-5 overflow-y-auto flex-1 min-h-0 pr-2 custom-scrollbar">
                <div>
                  <label className="block text-sm text-stone-400 mb-1">Decree Title</label>
                  <input type="text" value={newNoticeTitle} onChange={e => setNewNoticeTitle(e.target.value)} 
                     className="w-full bg-stone-950 border border-stone-700 p-3 rounded-lg text-stone-200 focus:border-amber-500 outline-none shadow-inner" 
                     placeholder="e.g. Bounty on the Black Knight" autoFocus />
                </div>
                <div>
                  <label className="block text-sm text-stone-400 mb-1 flex justify-between">
                     <span>Decree Content</span>
                     <span className="text-amber-600/70 text-xs italic">Tip: Ctrl+V to paste an image!</span>
                  </label>
                  <textarea value={newNoticeContent} onChange={e => setNewNoticeContent(e.target.value)} onPaste={handleNoticeImagePaste} 
                     className="w-full h-32 bg-stone-950 border border-stone-700 p-3 rounded-lg text-stone-200 focus:border-amber-500 outline-none resize-none shadow-inner leading-relaxed" 
                     placeholder="Write the official decree..." />
                </div>
                {attachedNoticeImage && (
                  <div>
                     <label className="block text-sm text-stone-400 mb-1">Attached Illustration</label>
                     <div className="relative inline-block">
                        <img src={attachedNoticeImage} alt="Notice Attachment" className="h-40 w-auto rounded border-2 border-stone-700 shadow-md object-contain bg-stone-950" />
                        <button onClick={() => setAttachedNoticeImage(null)} className="absolute -top-3 -right-3 bg-stone-900 border border-stone-600 rounded-full p-1.5 text-stone-400 hover:text-white hover:bg-red-900 transition-colors">
                           <X className="w-3 h-3"/>
                        </button>
                     </div>
                  </div>
                )}
             </div>
             
             <div className="flex gap-3 pt-6 border-t border-stone-800 shrink-0 mt-2">
                <button onClick={() => { setIsAddingNotice(false); setAttachedNoticeImage(null); }} className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg transition-colors border border-stone-600">Cancel</button>
                <button onClick={handleAddNotice} disabled={!newNoticeContent.trim() && !attachedNoticeImage} className="flex-1 py-3 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-100 font-bold rounded-lg transition-colors shadow-lg uppercase tracking-wider">Pin to Board</button>
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