import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home,
  GraduationCap,
  MessageSquare,
  History,
  User as UserIcon,
  Settings,
  Menu, 
  X, 
  Search, 
  Bell, 
  ChevronRight,
  Sparkles,
  FileText,
  Clock,
  BarChart3,
  Moon,
  Sun,
  Maximize2,
  Globe,
  Plus,
  LogOut,
  LogIn,
  HelpCircle,
  Mail,
  MessageCircle,
  AlertTriangle,
  Info,
  Send,
  Bot
} from 'lucide-react';
import { auth, signInWithGoogle, logout, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { sendMessage as sendGeminiMessage } from './services/geminiService';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  // Generation History State
  const [generations, setGenerations] = useState<{ id: string, tool: string, content: string, timestamp: any }[]>([]);
  const [historyFilter, setHistoryFilter] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Chatbot State
  const [chatMessages, setChatMessages] = useState<{ role: string, text: string, timestamp?: any }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [toolInput, setToolInput] = useState('');
  const [toolOutput, setToolOutput] = useState('');
  const [isToolLoading, setIsToolLoading] = useState(false);
  const scrollRef = useState<HTMLDivElement | null>(null)[0];

  const cleanText = (text: string) => {
    return text
      .replace(/[#*$\-_]/g, '') // Remove markdown symbols including underscore and dash
      .replace(/\s+/g, ' ')
      .trim();
  };

  useEffect(() => {
    if (!user) return;

    // Listen to chats
    const qChats = query(
      collection(db, 'users', user.uid, 'chats'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribeChats = onSnapshot(qChats, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as { role: string, text: string, timestamp?: any }[];
      setChatMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/chats`);
    });

    // Listen to generations
    const qGens = query(
      collection(db, 'users', user.uid, 'generations'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeGens = onSnapshot(qGens, (snapshot) => {
      const gens = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setGenerations(gens);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/generations`);
    });

    return () => {
      unsubscribeChats();
      unsubscribeGens();
    };
  }, [user]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setIsChatLoading(true);

    const path = `users/${user.uid}/chats`;
    try {
      // 1. Save user message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'chats'), {
        role: 'user',
        text: userMsg,
        timestamp: serverTimestamp()
      });

      // 2. Get AI response
      const history = chatMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const aiResponse = await sendGeminiMessage(userMsg, history);
      const cleanedResponse = cleanText(aiResponse || '');

      // 3. Save AI response to Firestore
      await addDoc(collection(db, 'users', user.uid, 'chats'), {
        role: 'model',
        text: cleanedResponse || 'Maaf, saya tidak bisa merespon saat ini.',
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolInput.trim() || !user || isToolLoading || !selectedTool) return;

    setIsToolLoading(true);
    setToolOutput('');

    try {
      const prompt = `Sebagai asisten akademik BimTEKs.ID, bantu saya dengan tool "${selectedTool.title}". Input pengguna: ${toolInput}. Berikan jawaban yang sangat bersih, profesional, tanpa karakter markdown seperti #, *, -, atau $.`;
      const response = await sendGeminiMessage(prompt, []);
      const cleanedResponse = cleanText(response || '');
      setToolOutput(cleanedResponse);

      // Save to history
      await addDoc(collection(db, 'users', user.uid, 'generations'), {
        tool: selectedTool.title,
        content: cleanedResponse,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Generation error:", error);
    } finally {
      setIsToolLoading(false);
    }
  };
  const [activeTab, setActiveTab] = useState('Home');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          // Test connection
          await getDocFromServer(doc(db, 'test', 'connection')).catch(() => {});
          
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: 'user'
            });
          }
        } catch (error) {
          console.error("Error syncing user:", error);
        }
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#001B3D]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-[#00E5B0] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white font-sans">
        {/* Navigation Header */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 md:px-16 sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <div className="bg-black text-white px-3 py-1 rounded-md font-bold text-xl flex items-center gap-1">
              <span>BIMTEKS</span>
              <div className="bg-blue-500 w-6 h-6 rounded-full flex items-center justify-center text-[10px]">
                AI
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-gray-900 font-semibold border-b-2 border-black pb-1">Home</a>
            <button onClick={handleLogin} className="text-gray-900 font-semibold hover:text-blue-600 transition-colors">Dashboard</button>
          </nav>

          <button 
            onClick={handleLogin}
            className="bg-[#00C192] hover:bg-[#00A87F] text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#00C192]/20"
          >
            <LogIn size={18} />
            Login
          </button>
        </header>

        {/* Hero Section */}
        <section className="relative bg-gradient-to-b from-[#001B3D] to-[#000D1F] pt-20 pb-40 px-6 overflow-hidden">
          <div className="max-w-5xl mx-auto text-center relative z-10">
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[#FFD700] font-bold tracking-widest mb-6"
            >
              BUNTU SAAT MENULIS?
            </motion.p>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-extrabold text-[#00E5B0] leading-tight mb-8"
            >
              Cara Membuat Karya Tulis 10x<br />
              Lebih Cepat dan Berkualitas! 🔥
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-[#FFA500] text-lg md:text-xl font-medium max-w-3xl mx-auto"
            >
              160+ Tools AI untuk membuat makalah, jurnal, skripsi, laporan, dll <span className="underline cursor-pointer hover:text-white transition-colors">dalam hitungan menit!</span>
            </motion.p>

            <motion.button
              onClick={handleLogin}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-12 bg-[#00E5B0] text-[#001B3D] px-10 py-4 rounded-full font-black text-xl shadow-2xl shadow-[#00E5B0]/30 hover:bg-white transition-all active:scale-95 flex items-center gap-3 mx-auto"
            >
              Mulai Sekarang Gratis
              <ChevronRight size={24} />
            </motion.button>

            {/* MacBook Mockup */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="mt-20 relative mx-auto max-w-4xl"
            >
              <div className="relative bg-gray-800 rounded-t-3xl p-2 shadow-2xl border-x-4 border-t-4 border-gray-700">
                <div className="bg-white rounded-xl overflow-hidden aspect-video shadow-inner flex">
                  {/* Sidebar Mockup */}
                  <div className="w-48 bg-white border-r border-gray-100 hidden md:flex flex-col p-4 gap-4 text-left">
                    <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-200 rounded"></div>
                        <div className="h-2 bg-gray-50 rounded w-full"></div>
                      </div>
                    ))}
                  </div>
                  {/* Content Mockup */}
                  <div className="flex-1 bg-gray-50 p-6 overflow-hidden">
                    <div className="flex justify-between items-center mb-8">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                      <div className="flex gap-2">
                        <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                        <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                          <div className="w-8 h-8 bg-blue-100 rounded mb-3"></div>
                          <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-2 bg-gray-100 rounded w-full"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-4 bg-gray-700 rounded-b-xl w-full relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gray-600 rounded-b-lg"></div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    );
  }

  // Dashboard View
  const panelMenuItems = [
    { id: 'Home', icon: Home, label: 'Home' },
    { id: 'Akademik', icon: GraduationCap, label: 'Akademik' },
    { id: 'Chatbot', icon: MessageSquare, label: 'Chatbot' },
    { id: 'Riwayat', icon: History, label: 'Riwayat Hasil' },
  ];

  const accountMenuItems = [
    { id: 'Profil', icon: UserIcon, label: 'Profil' },
    { id: 'Pengaturan', icon: Settings, label: 'Pengaturan' },
    { id: 'Bantuan', icon: HelpCircle, label: 'Bantuan' },
  ];

  const aiTools = [
    { title: 'Ide Karya Tulis', desc: 'Dapatkan ide karya tulis seperti essay, tesis, paper, jurnal, makalah, disertasi, artikel ilmiah untuk topik apapun.', icon: Sparkles },
    { title: 'Ide Karya Tulis dari Referensi', desc: 'Membuat ide karya tulis berdasarkan beberapa referensi valid dari berbagai sumber.', icon: Search },
    { title: 'Buat Makalah', desc: 'Buat makalah dengan topik atau tema apapun yang memberi kesan hasil riset yang baik dan ditulis oleh ahlinya.', icon: FileText },
    { title: 'Kerangka Berpikir', desc: 'Membantu menjelaskan teori atau konsep yang mendasari penelitian dan bagaimana variabel-variabel tersebut saling berhubungan.', icon: BarChart3 },
    { title: 'Buat Proposal Penelitian', desc: 'Buat proposal penelitian yang meyakinkan dan metodologis yang kokoh yang mengatasi kesenjangan atau isu signifikan dalam suatu bidang studi tertentu.', icon: GraduationCap },
    { title: 'Buat Skripsi', desc: 'Buat skripsi akademik berkualitas tinggi yang memberikan wawasan berharga kepada bidang studi tertentu.', icon: GraduationCap },
    { title: 'Sempurnakan Karya Tulis', desc: 'Sempurnakan karya tulis dari segi tata bahasa, ejaan, typo, struktur kalimat, pemilihan kalimat, dan sebagainya.', icon: MessageSquare },
    { title: 'Buat Essay', desc: 'Buat Essay dengan topik atau tema apapun yang memberi kesan hasil riset yang baik dan ditulis oleh ahlinya.', icon: FileText },
    { title: 'Kuesioner/Survey Kuantitatif', desc: 'Kembangkan survey/kuesioner untuk mengumpulkan data tentang topik/variabel apapun di konteks apapun.', icon: BarChart3 },
    { title: 'Panduan Wawancara Kualitatif', desc: 'Rancang panduan wawancara untuk mengeksplorasi topik/pertanyaan apapun untuk kepentingan penelitian.', icon: MessageSquare },
    { title: 'Buat Slide Presentasi PPT', desc: 'Membuat konten slide presentasi PPT beserta saran visual dan skrip pembicara. Tool ini hanya menggenerate teks.', icon: Maximize2 },
    { title: 'Penyusun Paragraf Otomatis', desc: 'Alat yang mengembangkan kata kunci menjadi paragraf terstruktur dengan gaya penulisan yang konsisten.', icon: FileText },
    { title: 'Review Jurnal', desc: 'Menulis review jurnal dengan merangkum, menganalisis, dan memberikan tinjauan kritis terhadap jurnal ilmiah dengan cepat dan efisien.', icon: Globe },
    { title: 'Analisa Karya Tulis', desc: 'Menganalisa dan mengoreksi suatu karya tulis seakan dinilai oleh dosen penguji.', icon: Search },
    { title: 'Perbaiki Karya Tulis', desc: 'Buat karya essay Anda atau karya tulis apapun terlihat lebih intelek dan berisi, dengan susunan kalimat dan tata bahasa yang baik dan pemilihan kalimat yang lebih elegan.', icon: Sparkles },
    { title: 'Cek Plagiarisme', desc: 'Deteksi tingkat kemiripan teks Anda dengan sumber internet dan database akademik untuk menjaga orisinalitas karya.', icon: History },
  ];

  return (
    <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${
      theme === 'dark' ? 'bg-[#0A0A0A] text-white' : 'bg-[#F8F9FA] text-[#1A1A1A]'
    }`}>
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className={`border-r flex flex-col z-20 relative shadow-sm transition-colors duration-300 ${
          theme === 'dark' ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.div 
                key="logo-full"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2"
              >
                <div className="bg-black text-white px-2 py-1 rounded font-bold text-lg flex items-center gap-1">
                  <span>BIMTEKS</span>
                  <div className="bg-blue-500 w-5 h-5 rounded-full flex items-center justify-center text-[8px]">AI</div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="logo-small"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-10 h-10 bg-black rounded flex items-center justify-center mx-auto"
              >
                <span className="text-white font-bold text-xs">B</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="mb-6">
            {isSidebarOpen && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Panel AI</p>}
            <div className="space-y-1">
              {panelMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group ${
                    activeTab === item.id 
                      ? 'bg-blue-50 text-blue-600 font-semibold' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon size={20} className={activeTab === item.id ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'} />
                  {isSidebarOpen && <span className="text-sm whitespace-nowrap">{item.label}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            {isSidebarOpen && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Akun</p>}
            <div className="space-y-1">
              {accountMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group ${
                    activeTab === item.id 
                      ? 'bg-blue-50 text-blue-600 font-semibold' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon size={20} className={activeTab === item.id ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'} />
                  {isSidebarOpen && <span className="text-sm whitespace-nowrap">{item.label}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-red-500 hover:bg-red-50 transition-all font-semibold ${!isSidebarOpen && 'justify-center'}`}
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="text-sm">Keluar</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className={`h-16 border-b flex items-center justify-between px-8 shadow-sm z-10 transition-colors duration-300 ${
          theme === 'dark' ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-100'
        }`}>
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-50 text-gray-500'
            }`}>
              <Menu size={20} />
            </button>
            <div className="relative group hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Cari alat AI..." 
                className={`pl-10 pr-4 py-1.5 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-100 transition-all ${
                  theme === 'dark' ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-gray-50 text-gray-900'
                }`}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
              theme === 'dark' ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'
            }`}>
              Buat Dokumen AI
              <ChevronRight size={14} className="rotate-90" />
            </button>
            <div className="flex items-center gap-2 border-l border-gray-100 pl-4">
              <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'dark' ? 'text-yellow-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50'
              }`}><Maximize2 size={18} /></button>
              <button className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50'
              }`}><Globe size={18} /></button>
              <div className={`w-8 h-8 rounded-full overflow-hidden border ${
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <img src={user.photoURL || ''} alt="User" referrerPolicy="no-referrer" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className={`flex-1 overflow-y-auto transition-colors duration-300 ${
          theme === 'dark' ? 'bg-[#0A0A0A]' : 'bg-[#F8F9FA]'
        }`}>
          {activeTab === 'Home' ? (
            <div className="p-8 max-w-7xl mx-auto">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Home</h1>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <Home size={12} />
                  <span>Panel AI</span>
                  <ChevronRight size={12} />
                  <span className="text-blue-600">Home</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Welcome Card */}
                <div className="lg:col-span-2 bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl p-8 text-white relative overflow-hidden shadow-lg shadow-blue-200">
                  <div className="relative z-10">
                    <p className="text-xs font-medium opacity-80 mb-2">
                      {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} pukul {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <h2 className="text-3xl font-bold mb-2">Welcome, {user.displayName}</h2>
                    <p className="text-sm opacity-90 mb-8">{user.email} - User ID: {user.uid.slice(0, 6)}</p>
                    
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 backdrop-blur-md px-4 py-3 rounded-xl">
                        <p className="text-[10px] uppercase font-bold opacity-70">Paket Saat Ini</p>
                        <p className="text-xl font-bold">Gratis Selamanya</p>
                        <p className="text-[10px] opacity-70 mt-1">Akses 16 Tools AI Terbaik</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                </div>

                {/* AI Writer Card */}
                <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-gray-400 mb-4">
                      <Sparkles size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">AI Tools</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Akses 16 Tools AI</h3>
                    <p className="text-sm text-gray-500 mb-6">Gunakan alat bimbingan teknis terbaik untuk membantu penulisan Anda.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('Akademik')}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    Buka Tools
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* Quota Section */}
              <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm mb-8">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Quota Kata</p>
                    <p className="text-2xl font-bold text-blue-600">Tak Terbatas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Penggunaan Gratis</p>
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 w-full"></div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Kata Dihasilkan</p>
                    <p className="text-2xl font-bold">0 kata</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <Sparkles size={24} />
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Dokumen Tersimpan</p>
                    <p className="text-2xl font-bold">0 dokumen</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <FileText size={24} />
                  </div>
                </div>
              </div>

              {/* AI Tools Grid */}
              <div className="mt-12">
                <h2 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>16 Tools AI Tersedia</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {aiTools.slice(0, 3).map((tool, i) => (
                    <div 
                      key={i} 
                      onClick={() => setActiveTab('Akademik')}
                      className={`p-6 rounded-2xl border transition-all cursor-pointer group ${
                        theme === 'dark' ? 'bg-[#111111] border-gray-800 hover:border-gray-700' : 'bg-white border-gray-100 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <tool.icon size={24} />
                      </div>
                      <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{tool.title}</h3>
                      <p className="text-sm text-gray-500">{tool.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'Akademik' ? (
            <div className="p-8 max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Akademik</h1>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <Home size={12} />
                  <span>Panel AI</span>
                  <ChevronRight size={12} />
                  <span className="text-blue-600">Akademik</span>
                </div>
              </div>

              {selectedTool ? (
                <div className={`rounded-2xl border p-8 ${
                  theme === 'dark' ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-100 shadow-sm'
                }`}>
                  <button 
                    onClick={() => {
                      setSelectedTool(null);
                      setToolInput('');
                      setToolOutput('');
                    }}
                    className="flex items-center gap-2 text-blue-600 font-bold text-sm mb-6 hover:gap-3 transition-all"
                  >
                    <ChevronRight size={16} className="rotate-180" />
                    Kembali ke Daftar Tools
                  </button>
                  
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                      <selectedTool.icon size={28} />
                    </div>
                    <div>
                      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedTool.title}</h2>
                      <p className="text-sm text-gray-500">{selectedTool.desc}</p>
                    </div>
                  </div>

                  <form onSubmit={handleGenerateTool} className="space-y-6">
                    <div>
                      <label className={`block text-sm font-bold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Input Pertanyaan / Topik
                      </label>
                      <textarea 
                        value={toolInput}
                        onChange={(e) => setToolInput(e.target.value)}
                        placeholder="Contoh: Bagaimana cara membuat kerangka berpikir untuk penelitian tentang AI di pendidikan?"
                        className={`w-full p-4 rounded-xl border-none focus:ring-2 focus:ring-blue-100 transition-all min-h-[150px] text-sm ${
                          theme === 'dark' ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-gray-50 text-gray-900'
                        }`}
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={!toolInput.trim() || isToolLoading}
                      className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {isToolLoading ? 'Sedang Memproses...' : 'Generate Sekarang'}
                      {!isToolLoading && <Sparkles size={18} />}
                    </button>
                  </form>

                  {toolOutput && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-10 p-8 rounded-2xl border ${
                        theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-blue-50/50 border-blue-100'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-6">
                        <h3 className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-blue-900'}`}>
                          <Sparkles size={20} className="text-blue-600" />
                          Hasil Generate
                        </h3>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(toolOutput);
                            alert('Hasil disalin!');
                          }}
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          Salin Hasil
                        </button>
                      </div>
                      <div className={`text-sm leading-relaxed whitespace-pre-wrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>
                        {toolOutput}
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                <>
                  <div className={`border rounded-2xl p-6 mb-8 flex items-center gap-4 ${
                    theme === 'dark' ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-100'
                  }`}>
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
                      <GraduationCap size={24} />
                    </div>
                    <div>
                      <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}`}>Bimbingan Akademik AI</h2>
                      <p className={`text-sm ${theme === 'dark' ? 'text-blue-300/80' : 'text-blue-700'}`}>Gunakan alat di bawah ini untuk membantu proses penelitian dan penulisan karya ilmiah Anda.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {aiTools.map((tool, i) => (
                      <motion.div 
                        key={i}
                        whileHover={{ y: -5 }}
                        onClick={() => setSelectedTool(tool)}
                        className={`p-6 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
                          theme === 'dark' ? 'bg-[#111111] border-gray-800 hover:border-gray-700' : 'bg-white border-gray-100 shadow-sm hover:shadow-md'
                        }`}
                      >
                        <div className="absolute top-4 right-4">
                          <span className="bg-black text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                            <Sparkles size={10} className="text-yellow-400" />
                            Gratis
                          </span>
                        </div>
                        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <tool.icon size={28} />
                        </div>
                        <h3 className={`text-xl font-bold mb-3 group-hover:text-blue-600 transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{tool.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed mb-6">{tool.desc}</p>
                        <button className="flex items-center gap-2 text-blue-600 font-bold text-sm group-hover:gap-3 transition-all">
                          Gunakan Sekarang
                          <ChevronRight size={16} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : activeTab === 'Chatbot' ? (
            <div className={`h-full flex flex-col transition-colors duration-300 ${
              theme === 'dark' ? 'bg-[#111111]' : 'bg-white'
            }`}>
              {/* Chat Header */}
              <div className={`p-6 border-b flex items-center justify-between ${
                theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
              }`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Chatbot Akademik</h2>
                    <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      AI Online & Siap Membantu
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setActiveTab('Riwayat')} className="p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <History size={20} />
                  </button>
                  <button onClick={() => setActiveTab('Pengaturan')} className="p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <Settings size={20} />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className={`flex-1 overflow-y-auto p-6 space-y-6 transition-colors duration-300 ${
                theme === 'dark' ? 'bg-[#0A0A0A]' : 'bg-[#F8F9FA]'
              }`}>
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 mb-6">
                      <Bot size={40} />
                    </div>
                    <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Halo, {user.displayName}!</h3>
                    <p className="text-gray-500">Saya adalah asisten AI BimTEKs.ID. Ada yang bisa saya bantu terkait tugas akademik atau penelitian Anda hari ini?</p>
                    <div className="grid grid-cols-1 gap-3 mt-8 w-full">
                      <button onClick={() => setChatInput("Bagaimana cara membuat kerangka berpikir yang baik?")} className={`p-3 border rounded-xl text-sm transition-all text-left ${
                        theme === 'dark' ? 'bg-[#111111] border-gray-800 text-gray-400 hover:border-blue-600 hover:text-blue-600' : 'bg-white border-gray-100 text-gray-600 hover:border-blue-200 hover:text-blue-600'
                      }`}>
                        "Bagaimana cara membuat kerangka berpikir yang baik?"
                      </button>
                      <button onClick={() => setChatInput("Bantu saya mencari ide judul skripsi tentang AI.")} className={`p-3 border rounded-xl text-sm transition-all text-left ${
                        theme === 'dark' ? 'bg-[#111111] border-gray-800 text-gray-400 hover:border-blue-600 hover:text-blue-600' : 'bg-white border-gray-100 text-gray-600 hover:border-blue-200 hover:text-blue-600'
                      }`}>
                        "Bantu saya mencari ide judul skripsi tentang AI."
                      </button>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-100 dark:bg-gray-800 dark:border-gray-700 text-blue-600'
                        }`}>
                          {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-tr-none' 
                            : `rounded-tl-none ${theme === 'dark' ? 'bg-gray-800 text-gray-200 border border-gray-700' : 'bg-white text-gray-700 border border-gray-100'}`
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-blue-600 flex items-center justify-center">
                        <Bot size={16} />
                      </div>
                      <div className={`p-4 rounded-2xl rounded-tl-none flex gap-1 ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border-gray-100'}`}>
                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className={`p-6 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
                <form onSubmit={handleSendChatMessage} className="relative">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ketik pertanyaan Anda di sini..."
                    className={`w-full pl-6 pr-16 py-4 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 transition-all text-sm ${
                      theme === 'dark' ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-gray-50 text-gray-900'
                    }`}
                  />
                  <button 
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all"
                  >
                    <Send size={20} />
                  </button>
                </form>
                <p className="text-[10px] text-gray-400 text-center mt-4">
                  AI dapat memberikan informasi yang tidak akurat. Selalu verifikasi hasil riset Anda.
                </p>
              </div>
            </div>
          ) : activeTab === 'Riwayat' ? (
            <div className="p-8 max-w-7xl mx-auto">
              <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Riwayat Hasil Generate</h1>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <Home size={12} />
                    <span>Panel AI</span>
                    <ChevronRight size={12} />
                    <span className="text-blue-600">Riwayat</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Filter tool..."
                      value={historyFilter}
                      onChange={(e) => setHistoryFilter(e.target.value)}
                      className={`pl-9 pr-4 py-2 text-sm border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all ${
                        theme === 'dark' ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-white shadow-sm'
                      }`}
                    />
                  </div>
                  <input 
                    type="date" 
                    value={historyDateFilter}
                    onChange={(e) => setHistoryDateFilter(e.target.value)}
                    className={`px-4 py-2 text-sm border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all ${
                      theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white shadow-sm'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-4">
                {generations
                  .filter(gen => 
                    gen.tool.toLowerCase().includes(historyFilter.toLowerCase()) &&
                    (!historyDateFilter || (gen.timestamp?.toDate().toISOString().split('T')[0] === historyDateFilter))
                  )
                  .map((gen) => (
                    <motion.div 
                      key={gen.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-6 rounded-2xl border transition-all ${
                        theme === 'dark' 
                          ? 'bg-[#111111] border-gray-800 hover:border-gray-700' 
                          : 'bg-white border-gray-100 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{gen.tool}</h3>
                            <p className="text-xs text-gray-500">
                              {gen.timestamp?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(gen.content);
                            alert('Konten disalin ke clipboard!');
                          }}
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          Salin Teks
                        </button>
                      </div>
                      <div className={`text-sm leading-relaxed line-clamp-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {gen.content}
                      </div>
                    </motion.div>
                  ))}
                
                {generations.length === 0 && (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-4">
                      <History size={32} />
                    </div>
                    <p className="text-gray-500">Belum ada riwayat generate.</p>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'Pengaturan' ? (
            <div className="p-8 max-w-4xl mx-auto">
              <div className="mb-8">
                <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Pengaturan</h1>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <Home size={12} />
                  <span>Panel AI</span>
                  <ChevronRight size={12} />
                  <span className="text-blue-600">Pengaturan</span>
                </div>
              </div>

              <div className={`rounded-2xl border overflow-hidden ${
                theme === 'dark' ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-100 shadow-sm'
              }`}>
                <div className="p-8 space-y-8">
                  <section>
                    <h3 className={`text-sm font-bold uppercase tracking-widest mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Tampilan</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          theme === 'dark' ? 'bg-gray-800 text-yellow-400' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
                        </div>
                        <div>
                          <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Mode Gelap</p>
                          <p className="text-sm text-gray-500">Ubah tampilan aplikasi menjadi gelap atau terang.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                        className={`w-14 h-7 rounded-full relative transition-all duration-300 ${
                          theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 ${
                          theme === 'dark' ? 'left-8' : 'left-1'
                        }`} />
                      </button>
                    </div>
                  </section>

                  <div className={`h-px ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`} />

                  <section>
                    <h3 className={`text-sm font-bold uppercase tracking-widest mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Model AI</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          theme === 'dark' ? 'bg-gray-800 text-blue-400' : 'bg-gray-100 text-blue-600'
                        }`}>
                          <Sparkles size={24} />
                        </div>
                        <div>
                          <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Model Standar</p>
                          <p className="text-sm text-gray-500">Menggunakan Gemini 3 Flash untuk performa optimal.</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-600 text-xs font-bold rounded-full">Aktif</span>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          ) : activeTab === 'Bantuan' ? (
            <div className="p-8 max-w-4xl mx-auto">
              <div className="mb-8">
                <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Bantuan & Informasi</h1>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <Home size={12} />
                  <span>Panel AI</span>
                  <ChevronRight size={12} />
                  <span className="text-blue-600">Bantuan</span>
                </div>
              </div>

              <div className={`rounded-2xl border overflow-hidden ${
                theme === 'dark' ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-100 shadow-sm'
              }`}>
                <div className="bg-blue-600 p-6 text-white">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Info size={24} />
                    INFORMASI SISTEM
                  </h2>
                </div>
                <div className="p-8 space-y-6">
                  <div className="prose prose-blue max-w-none">
                    <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} leading-relaxed`}>
                      <strong>Academic Study ID</strong> saat ini masih dalam tahap pengembangan oleh admin. 
                      Apabila terjadi kesalahan, gangguan, atau fitur yang belum berjalan sempurna, kami mohon pengertiannya.
                    </p>
                    
                    <div className={`rounded-xl p-6 border mt-6 ${
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-100'
                    }`}>
                      <p className={`font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Silakan sampaikan masukan atau laporan kendala melalui:</p>
                      <div className="space-y-4">
                        <a href="mailto:patriotdanielkromsian@gmail.com" className="flex items-center gap-3 text-blue-600 hover:underline">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600">
                            <Mail size={20} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 font-bold uppercase">Email Admin</p>
                            <p className="font-medium">patriotdanielkromsian@gmail.com</p>
                          </div>
                        </a>
                        <a href="https://wa.me/6282354169298" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-green-600 hover:underline">
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600">
                            <MessageCircle size={20} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 font-bold uppercase">WhatsApp Admin</p>
                            <p className="font-medium">+62 823 5416 9298</p>
                          </div>
                        </a>
                      </div>
                    </div>

                    <div className="mt-8">
                      <h3 className={`font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Fitur Bantuan Tersedia:</h3>
                      <ul className={`list-disc list-inside space-y-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        <li>Kirim Email langsung ke Admin</li>
                        <li>Chat WhatsApp langsung ke Admin</li>
                      </ul>
                    </div>

                    <div className="mt-8 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 rounded-r-xl">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold mb-2">
                        <AlertTriangle size={20} />
                        ⚠️ Ketentuan Laporan:
                      </div>
                      <p className="text-amber-700 dark:text-amber-300 text-sm">
                        Sebelum mengirim pesan, pengguna wajib mengunggah bukti scrinsut untuk sistem yang bermasalah agar laporan dapat diproses dengan cepat dan tepat oleh admin.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center justify-center h-full text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
                theme === 'dark' ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-300'
              }`}>
                <Settings size={40} />
              </div>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Menu {activeTab}</h2>
              <p className="text-gray-500 mt-2">Halaman ini sedang dalam pengembangan.</p>
              <button onClick={() => setActiveTab('Home')} className="mt-6 text-blue-600 font-semibold flex items-center gap-2">
                <Home size={18} />
                Kembali ke Home
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
