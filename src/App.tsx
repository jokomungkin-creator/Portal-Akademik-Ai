import React, { useState, useEffect, Component, useMemo, useRef } from 'react';
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
  Bot,
  Download,
  Save,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Type,
  Pencil,
  Image as ImageIcon,
  Link as LinkIcon,
  Code,
  Quote,
  MoreHorizontal,
  Star,
  Zap,
  Lightbulb,
  Languages,
  ShieldCheck,
  Share2
} from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
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
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
import { sendMessage as sendGeminiMessage } from './services/geminiService';
import { Login } from './components/Login';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function safeStringify(obj: any) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    // Handle Error objects specifically as their properties are often non-enumerable
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    // Handle circular references using the suggested WeakSet pattern
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  });
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? { message: error.message, name: error.name } : error,
    operationType,
    path: path || 'unknown',
    userId: auth.currentUser?.uid || 'anonymous',
    email: auth.currentUser?.email || 'anonymous',
    timestamp: new Date().toISOString()
  };

  const errString = safeStringify(errInfo);
  console.error('Firestore Error:', errString);
  throw new Error(errString);
}

class EditorErrorBoundary extends Component<any, any> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Editor Error Caught:", safeStringify({ error, errorInfo }));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <h2 className="text-xl font-bold text-red-500">Terjadi error editor</h2>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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
  const [content, setContent] = useState("");
  const quillRef = useRef<any>(null);

  // Load data saat aplikasi dibuka
  useEffect(() => {
    const saved = localStorage.getItem("my_document");
    if (saved) {
      setContent(saved);
    }
  }, []);

  // Simpan otomatis ke localStorage
  useEffect(() => {
    localStorage.setItem("my_document", content);
  }, [content]);

  const [isToolLoading, setIsToolLoading] = useState(false);

  const editorModules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link', 'image', 'code-block'],
      ['clean']
    ]
  }), []);

  // Export ke txt
  const exportText = () => {
    const text = content.replace(/<[^>]*>/g, "");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "dokumen.txt";
    a.click();

    URL.revokeObjectURL(url);
  };

  // Tool Config State
  const [toolLanguage, setToolLanguage] = useState('Bahasa Indonesia');
  const [numIdeas, setNumIdeas] = useState(5);
  const [writingType, setWritingType] = useState('Makalah');
  const [creativity, setCreativity] = useState('Asli');
  const [tone, setTone] = useState('Professional');
  const [numResults, setNumResults] = useState(1);
  const [maxResultLength, setMaxResultLength] = useState(1500);
  const [aiModel, setAiModel] = useState('Premium');

  // Document State
  const [docName, setDocName] = useState('Dokumen Baru');
  const [workbook, setWorkbook] = useState('Semua Workbook');

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
    setContent('');

    try {
      const prompt = `Sebagai asisten akademik BimTEKs.ID, bantu saya dengan tool "${selectedTool.title}". 
      Bahasa: ${toolLanguage}
      Jumlah Ide: ${numIdeas}
      Jenis Karya Tulis: ${writingType}
      Topik atau Tema: ${toolInput}
      Model AI: ${aiModel}
      Kreativitas: ${creativity}
      Nada Tulisan: ${tone}
      Jumlah Hasil: ${numResults}
      Panjang Hasil Maks: ${maxResultLength}
      
      Berikan jawaban yang sangat bersih, profesional, tanpa karakter markdown seperti #, *, -, atau $.`;
      
      const response = await sendGeminiMessage(prompt, []);
      const cleanedResponse = cleanText(response || '');
      setContent(cleanedResponse);

      // Save to history
      const genPath = `users/${user.uid}/generations`;
      await addDoc(collection(db, 'users', user.uid, 'generations'), {
        tool: selectedTool.title,
        content: cleanedResponse,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/generations`);
    } finally {
      setIsToolLoading(false);
    }
  };

  const handleDeleteGeneration = async (id: string) => {
    if (!user) return;
    const path = `users/${user.uid}/generations/${id}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'generations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const [activeTab, setActiveTab] = useState('Home');
  const [academicMode, setAcademicMode] = useState(true);
  const [plagiarism, setPlagiarism] = useState(true);
  const [interdisciplinary, setInterdisciplinary] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
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
          console.error("Error syncing user:", error instanceof Error ? error.message : String(error));
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
    if (isLoggingIn) return;
    
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request') {
        console.log("Popup request was cancelled by a new request or user action.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.log("User closed the login popup.");
      } else {
        console.error("Login failed", error instanceof Error ? error.message : String(error));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed", error instanceof Error ? error.message : String(error));
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
    return <Login onLogin={handleLogin} isLoggingIn={isLoggingIn} />;
  }

  // Dashboard View
  const panelMenuItems = [
    { id: 'Home', icon: Home, label: 'Home' },
    { id: 'Akademik', icon: GraduationCap, label: 'Akademik' },
    { id: 'Chatbot', icon: MessageSquare, label: 'Chatbot Akademik' },
    { id: 'Riwayat', icon: History, label: 'Riwayat Hasil' },
  ];

  const accountMenuItems = [
    { id: 'Profil', icon: UserIcon, label: 'Profil' },
    { id: 'Pengaturan', icon: Settings, label: 'Pengaturan' },
    { id: 'Bantuan', icon: HelpCircle, label: 'Bantuan' },
  ];

  const aiTools = [
    { 
      title: 'Ide Karya Tulis', 
      desc: 'Dapatkan ide karya tulis seperti essay, tesis, paper, jurnal, makalah, disertasi, artikel ilmiah untuk topik apapun.', 
      icon: Lightbulb 
    },
    { 
      title: 'Ide Karya Tulis dari Referensi', 
      desc: 'Membuat ide karya tulis berdasarkan beberapa referensi valid dari berbagai sumber. Masukkan abstrak atau judul referensi, dan AI akan mensintesis ide baru yang orisinal.', 
      icon: Search 
    },
    { 
      title: 'Buat Makalah', 
      desc: 'Buat makalah dengan topik atau tema apapun yang memberi kesan hasil riset yang baik dan ditulis oleh ahlinya. Lengkap dengan pendahuluan, pembahasan sistematis, dan kesimpulan.', 
      icon: FileText 
    },
    { 
      title: 'Kerangka Berpikir', 
      desc: 'Membantu menjelaskan teori atau konsep yang mendasari penelitian dan bagaimana variabel-variabel tersebut saling berhubungan dalam bentuk narasi logis yang kuat.', 
      icon: BarChart3 
    },
    { 
      title: 'Buat Proposal Penelitian', 
      desc: 'Buat proposal penelitian yang meyakinkan dan metodologis yang kokoh yang mengatasi kesenjangan atau isu signifikan dalam suatu bidang studi tertentu, mencakup latar belakang hingga metode.', 
      icon: GraduationCap 
    },
    { 
      title: 'Buat Skripsi', 
      desc: 'Buat skripsi akademik berkualitas tinggi yang memberikan wawasan berharga kepada bidang studi tertentu. Membantu menyusun bab demi bab dengan standar akademik yang ketat.', 
      icon: GraduationCap 
    },
    { 
      title: 'Sempurnakan Karya Tulis', 
      desc: 'Sempurnakan karya tulis dari segi tata bahasa, ejaan, typo, struktur kalimat, pemilihan kalimat, dan koherensi antar paragraf agar terlihat lebih profesional.', 
      icon: MessageSquare 
    },
    { 
      title: 'Buat Essay', 
      desc: 'Buat Essay dengan topik atau tema apapun yang memberi kesan hasil riset yang baik dan ditulis oleh ahlinya. Fokus pada argumen yang tajam dan alur pemikiran yang mengalir.', 
      icon: FileText 
    },
    { 
      title: 'Kuesioner/Survey Kuantitatif', 
      desc: 'Kembangkan survey/kuesioner untuk mengumpulkan data tentang topik/variabel apapun di konteks apapun, lengkap dengan skala pengukuran yang sesuai (misal: Likert).', 
      icon: BarChart3 
    },
    { 
      title: 'Panduan Wawancara Kualitatif', 
      desc: 'Rancang panduan wawancara untuk mengeksplorasi topik/pertanyaan apapun untuk kepentingan penelitian kualitatif, mencakup pertanyaan pembuka, inti, dan penutup.', 
      icon: MessageSquare 
    },
    { 
      title: 'Buat Slide Presentasi PPT', 
      desc: 'Membuat konten slide presentasi PPT beserta saran visual dan skrip pembicara. AI akan menyusun poin-poin kunci per slide agar presentasi Anda efektif dan menarik.', 
      icon: Maximize2 
    },
    { 
      title: 'Penyusun Paragraf Otomatis', 
      desc: 'Alat yang mengembangkan kata kunci menjadi paragraf terstruktur dengan gaya penulisan yang konsisten, membantu mengatasi writer\'s block dengan cepat.', 
      icon: FileText 
    },
    { 
      title: 'Review Jurnal', 
      desc: 'Menulis review jurnal dengan merangkum, menganalisis, dan memberikan tinjauan kritis terhadap jurnal ilmiah dengan cepat dan efisien sesuai standar publikasi.', 
      icon: Globe 
    },
    { 
      title: 'Analisa Karya Tulis', 
      desc: 'Menganalisa dan mengoreksi suatu karya tulis seakan dinilai oleh dosen penguji, memberikan feedback konstruktif pada kekuatan dan kelemahan argumen.', 
      icon: Search 
    },
    { 
      title: 'Perbaiki Karya Tulis', 
      desc: 'Buat karya essay Anda atau karya tulis apapun terlihat lebih intelek dan berisi, dengan susunan kalimat yang lebih elegan dan pemilihan diksi akademik yang tepat.', 
      icon: Sparkles 
    },
    { 
      title: 'Cek Plagiarisme', 
      desc: 'Deteksi tingkat kemiripan teks Anda dengan sumber internet dan database akademik untuk menjaga orisinalitas karya serta memberikan saran sitasi yang benar.', 
      icon: History 
    },
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
            <div className={`h-full flex flex-col ${selectedTool ? '' : 'p-8 max-w-7xl mx-auto w-full'}`}>
              {!selectedTool && (
                <div className="mb-8">
                  <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Akademik</h1>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <Home size={12} />
                    <span>Panel AI</span>
                    <ChevronRight size={12} />
                    <span className="text-blue-600">Akademik</span>
                  </div>
                </div>
              )}

              {selectedTool ? (
                <div className={`flex flex-col lg:flex-row gap-6 h-full overflow-hidden p-6 ${
                  theme === 'dark' ? 'bg-[#0A0A0A]' : 'bg-[#F8F9FA]'
                }`}>
                  {/* Left Sidebar - Configuration */}
                  <div className={`lg:w-[350px] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar p-6 rounded-2xl border ${
                    theme === 'dark' ? 'bg-[#111111] border-gray-800 text-gray-300' : 'bg-white border-gray-200 text-gray-700 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => {
                          setSelectedTool(null);
                          setToolInput('');
                          setContent('');
                        }}
                        className="flex items-center gap-2 text-blue-600 font-bold text-sm hover:gap-3 transition-all"
                      >
                        <ChevronRight size={16} className="rotate-180" />
                        Kembali
                      </button>
                      <Sparkles size={20} className="text-yellow-400" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-yellow-400">
                          {React.createElement(selectedTool.icon, { size: 24 })}
                        </div>
                        <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedTool.title}</h2>
                        <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <Sparkles size={10} className="text-yellow-400" />
                          Gratis
                        </span>
                      </div>
                      <button className="text-gray-400 hover:text-yellow-400 transition-colors">
                        <Star size={20} />
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 leading-relaxed">
                      {selectedTool.desc}
                    </p>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl flex items-center gap-3 border border-blue-100 dark:border-blue-800">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                        <Zap size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Kuota Anda = 2.2K Kata</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Bahasa */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">Bahasa</label>
                        <div className="relative">
                          <select 
                            value={toolLanguage}
                            onChange={(e) => setToolLanguage(e.target.value)}
                            className={`w-full p-3 rounded-xl border text-sm appearance-none pr-10 ${
                              theme === 'dark' ? 'bg-[#111111] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                            }`}
                          >
                            <option value="Bahasa Indonesia">Indonesian (Indonesia)</option>
                            <option value="Bahasa Inggris">English (United States)</option>
                          </select>
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2">
                            <span className="text-lg">{toolLanguage === 'Bahasa Indonesia' ? '🇮🇩' : '🇺🇸'}</span>
                          </div>
                          <ChevronRight size={16} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Jumlah Ide */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">Jumlah Ide</label>
                        <input 
                          type="text"
                          value={numIdeas || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) {
                              setNumIdeas(val === '' ? 0 : Number(val));
                            }
                          }}
                          placeholder="Butuh berapa ide? max 10"
                          className={`w-full p-3 rounded-xl border text-sm ${
                            theme === 'dark' ? 'bg-[#111111] border-gray-800 text-white placeholder-gray-600' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                          }`}
                        />
                      </div>

                      {/* Jenis Karya Tulis */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">Jenis Karya Tulis</label>
                        <input 
                          type="text"
                          value={writingType}
                          onChange={(e) => setWritingType(e.target.value)}
                          placeholder="essay, tesis, jurnal, makalah, paper, artikel ilmiah, disetasi etc"
                          className={`w-full p-3 rounded-xl border text-sm ${
                            theme === 'dark' ? 'bg-[#111111] border-gray-800 text-white placeholder-gray-600' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                          }`}
                        />
                      </div>

                      {/* Topik atau Tema */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">
                          {selectedTool.title === 'Ide Karya Tulis dari Referensi' ? 'Referensi (Judul/Abstrak)' : 'Topik atau Tema'}
                        </label>
                        <div className="relative">
                          <textarea 
                            value={toolInput}
                            onChange={(e) => setToolInput(e.target.value)}
                            placeholder={selectedTool.title === 'Ide Karya Tulis dari Referensi' ? 'Masukkan judul atau abstrak referensi...' : 'Masukkan lingkup topik atau tema'}
                            className={`w-full p-3 rounded-xl border text-sm min-h-[100px] pr-10 ${
                              theme === 'dark' ? 'bg-[#111111] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                            }`}
                          />
                          {toolInput && (
                            <button 
                              onClick={() => setToolInput('')}
                              className="absolute right-3 top-3 text-gray-400 hover:text-red-500 transition-colors"
                              title="Hapus referensi"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Model AI */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">Model AI</label>
                        <div className="relative">
                          <select 
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                            className={`w-full p-3 rounded-xl border text-sm appearance-none pr-10 ${
                              theme === 'dark' ? 'bg-[#111111] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                            }`}
                          >
                            <option value="Premium">Premium</option>
                            <option value="Standard">Standard</option>
                          </select>
                          <ChevronRight size={16} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Kreativitas */}
                        <div>
                          <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">
                            Kreativitas
                            <Info size={10} className="text-gray-400" />
                          </label>
                          <div className="relative">
                            <select 
                              value={creativity}
                              onChange={(e) => setCreativity(e.target.value)}
                              className={`w-full p-3 rounded-xl border text-sm appearance-none pr-10 ${
                                theme === 'dark' ? 'bg-[#111111] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                              }`}
                            >
                              <option>Asli</option>
                              <option>Kreatif</option>
                              <option>Sangat Kreatif</option>
                            </select>
                            <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-400 pointer-events-none" />
                          </div>
                        </div>

                        {/* Nada Tulisan */}
                        <div>
                          <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">
                            Nada Tulisan
                            <Info size={10} className="text-gray-400" />
                          </label>
                          <div className="relative">
                            <select 
                              value={tone}
                              onChange={(e) => setTone(e.target.value)}
                              className={`w-full p-3 rounded-xl border text-sm appearance-none pr-10 ${
                                theme === 'dark' ? 'bg-[#111111] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                              }`}
                            >
                              <option>Professional</option>
                              <option>Akademik</option>
                              <option>Formal</option>
                              <option>Casual</option>
                            </select>
                            <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Jumlah Hasil */}
                        <div>
                          <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">
                            Jumlah Hasil
                            <Info size={10} className="text-gray-400" />
                          </label>
                          <input 
                            type="text"
                            value={numResults || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d+$/.test(val)) {
                                setNumResults(val === '' ? 0 : Number(val));
                              }
                            }}
                            className={`w-full p-3 rounded-xl border text-sm ${
                              theme === 'dark' ? 'bg-[#111111] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                            }`}
                          />
                        </div>

                        {/* Panjang Hasil Maks */}
                        <div>
                          <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">
                            Panjang Hasil Maks
                            <Info size={10} className="text-gray-400" />
                          </label>
                          <input 
                            type="text"
                            value={maxResultLength || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d+$/.test(val)) {
                                setMaxResultLength(val === '' ? 0 : Number(val));
                              }
                            }}
                            className={`w-full p-3 rounded-xl border text-sm ${
                              theme === 'dark' ? 'bg-[#111111] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={handleGenerateTool}
                      disabled={!toolInput.trim() || isToolLoading}
                      className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                      {isToolLoading ? 'Sedang Memproses...' : 'Hasilkan'}
                      {!isToolLoading && <Sparkles size={18} />}
                    </button>
                  </div>

                  {/* Right Content - Editor/Output */}
                  <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between gap-4">
                      <input 
                        type="text"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        className={`flex-1 p-3 rounded-xl border text-sm font-medium focus:ring-2 focus:ring-blue-100 transition-all ${
                          theme === 'dark' ? 'bg-[#111111] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                        }`}
                      />
                      <div className="relative">
                        <select 
                          value={workbook}
                          onChange={(e) => setWorkbook(e.target.value)}
                          className={`p-3 pr-10 rounded-xl border text-sm font-medium appearance-none ${
                            theme === 'dark' ? 'bg-[#111111] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'
                          }`}
                        >
                          <option>Semua Workbook</option>
                          <option>Tugas Kuliah</option>
                          <option>Skripsi</option>
                          <option>Jurnal</option>
                        </select>
                        <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-400 pointer-events-none" />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const blob = new Blob([content], { type: 'application/msword' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${docName}.doc`;
                            a.click();
                          }}
                          className={`p-3 rounded-xl border hover:bg-gray-50 transition-colors ${
                            theme === 'dark' ? 'bg-[#111111] border-gray-800 text-gray-400' : 'bg-white border-gray-200 text-gray-600'
                          }`}
                        >
                          <Download size={18} />
                        </button>
                        <button 
                          className={`p-3 rounded-xl border hover:bg-gray-50 transition-colors ${
                            theme === 'dark' ? 'bg-[#111111] border-gray-800 text-gray-400' : 'bg-white border-gray-200 text-gray-600'
                          }`}
                        >
                          <Save size={18} />
                        </button>
                      </div>
                    </div>

                    <div className={`flex-1 rounded-2xl border flex flex-col overflow-hidden ${
                      theme === 'dark' ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200 shadow-sm'
                    }`}>
                      {/* Editor Area */}
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <style>{`
                          .quill { height: 100%; display: flex; flex-direction: column; }
                          .ql-toolbar { 
                            background: ${theme === 'dark' ? '#1F2937' : '#F9FAFB'} !important; 
                            border: none !important; 
                            border-bottom: 1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'} !important;
                          }
                          .ql-container { 
                            border: none !important; 
                            flex: 1; 
                            overflow-y: auto; 
                            background: ${theme === 'dark' ? '#111827' : '#FFFFFF'}; 
                            color: ${theme === 'dark' ? '#E5E7EB' : '#374151'}; 
                          }
                          .ql-editor { padding: 32px !important; min-height: 100%; }
                          .ql-snow .ql-stroke { stroke: ${theme === 'dark' ? '#9CA3AF' : '#4B5563'} !important; }
                          .ql-snow .ql-fill { fill: ${theme === 'dark' ? '#9CA3AF' : '#4B5563'} !important; }
                          .ql-snow .ql-picker { color: ${theme === 'dark' ? '#9CA3AF' : '#4B5563'} !important; }
                        `}</style>

                        <EditorErrorBoundary>
                          <ReactQuill 
                            theme="snow"
                            value={content}
                            onChange={(value) => setContent(value)}
                            placeholder="Hasil generate akan muncul di sini..."
                            modules={editorModules}
                          />
                        </EditorErrorBoundary>
                      </div>

                      {/* Footer */}
                      <div className={`p-4 border-t flex items-center justify-between text-[10px] font-bold uppercase tracking-wider ${
                        theme === 'dark' ? 'border-gray-800 bg-[#111111] text-gray-500' : 'border-gray-100 bg-gray-50 text-gray-400'
                      }`}>
                        <div>Total Words: {content ? content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0}</div>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={exportText}
                            className="text-blue-600 hover:underline"
                          >
                            Export TXT
                          </button>
                          <button 
                            onClick={() => {
                              if (!content) return;
                              const blob = new Blob([content.replace(/<[^>]*>/g, '')], { type: 'application/msword' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${docName}.doc`;
                              a.click();
                            }}
                            className="text-blue-600 hover:underline"
                          >
                            Ubah ke Word
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floating Action Button */}
                  <div className="fixed bottom-8 right-8 z-30">
                    <button className="w-12 h-12 bg-blue-600 text-white rounded-xl shadow-xl flex items-center justify-center hover:scale-110 transition-transform">
                      <ChevronRight size={24} className="-rotate-90" />
                    </button>
                  </div>
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
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 mb-6">
                      <Bot size={40} />
                    </div>
                    <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Halo! 👋</h3>
                    <p className={`mb-4 px-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                      Saya adalah <strong>Chatbot Akademik</strong> dari BimTEKs.ID. Ada yang bisa saya bantu terkait skripsi, makalah, proposal penelitian, kerangka berpikir, atau tugas akademik Anda hari ini? Cukup ketikkan pertanyaan Anda, dan saya bantu langsung 😊
                    </p>
                    
                    <div className={`p-4 rounded-2xl border mb-8 text-sm leading-relaxed ${
                      theme === 'dark' ? 'bg-blue-900/10 border-blue-900/30 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-700'
                    }`}>
                      🔥 <strong>Chatbot Akademik</strong> — GRATIS untuk semua pengguna! Bantu kamu membuat skripsi, makalah, proposal, kuesioner, kerangka berpikir, presentasi PPT, hingga analisis teori. Lebih lengkap dari AI berbayar, lebih cepat dari dosen pembimbing, dan selalu tersedia 24 jam. Mulai tanya sekarang dan rasakan kemudahannya! 🚀
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
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
                      <button onClick={() => setChatInput("Buatkan outline untuk proposal penelitian kualitatif.")} className={`p-3 border rounded-xl text-sm transition-all text-left ${
                        theme === 'dark' ? 'bg-[#111111] border-gray-800 text-gray-400 hover:border-blue-600 hover:text-blue-600' : 'bg-white border-gray-100 text-gray-600 hover:border-blue-200 hover:text-blue-600'
                      }`}>
                        "Buatkan outline untuk proposal penelitian kualitatif."
                      </button>
                      <button onClick={() => setChatInput("Apa saja fitur yang tersedia di BimTEKs.ID?")} className={`p-3 border rounded-xl text-sm transition-all text-left ${
                        theme === 'dark' ? 'bg-[#111111] border-gray-800 text-gray-400 hover:border-blue-600 hover:text-blue-600' : 'bg-white border-gray-100 text-gray-600 hover:border-blue-200 hover:text-blue-600'
                      }`}>
                        "Apa saja fitur yang tersedia di BimTEKs.ID?"
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
                  {(historyFilter || historyDateFilter) && (
                    <button 
                      onClick={() => {
                        setHistoryFilter('');
                        setHistoryDateFilter('');
                      }}
                      className="text-xs font-bold text-red-500 hover:underline px-2"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {generations
                  .filter(gen => {
                    const matchesTool = gen.tool.toLowerCase().includes(historyFilter.toLowerCase());
                    let matchesDate = true;
                    if (historyDateFilter && gen.timestamp) {
                      try {
                        const genDate = gen.timestamp.toDate().toISOString().split('T')[0];
                        matchesDate = genDate === historyDateFilter;
                      } catch (e) {
                        matchesDate = false;
                      }
                    }
                    return matchesTool && matchesDate;
                  })
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
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(gen.content);
                            }}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            Salin Teks
                          </button>
                          <button 
                            onClick={() => handleDeleteGeneration(gen.id)}
                            className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1"
                          >
                            Hapus
                          </button>
                        </div>
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
                <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Pengaturan</h1>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <Home size={12} />
                  <span>Panel AI</span>
                  <ChevronRight size={12} />
                  <span className="text-blue-600 font-bold uppercase tracking-wider">Pengaturan</span>
                </div>
              </div>

              <div className={`rounded-3xl border overflow-hidden ${
                theme === 'dark' ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-100 shadow-xl'
              }`}>
                <div className="p-10 space-y-10">
                  {/* TAMPILAN */}
                  <section>
                    <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-8 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Tampilan</h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            theme === 'dark' ? 'bg-gray-800 text-yellow-400' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
                          </div>
                          <div>
                            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Mode Gelap</p>
                            <p className="text-sm text-gray-500">Ubah tampilan aplikasi menjadi gelap atau terang.</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                          className={`w-14 h-7 rounded-full relative transition-all duration-500 ${
                            theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-500 ${
                            theme === 'dark' ? 'left-8' : 'left-1'
                          }`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            theme === 'dark' ? 'bg-gray-800 text-blue-400' : 'bg-blue-50 text-blue-600'
                          }`}>
                            <Languages size={24} />
                          </div>
                          <div>
                            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Bahasa Aplikasi</p>
                            <p className="text-sm text-gray-500">Pilih bahasa antarmuka aplikasi.</p>
                          </div>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                          theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                        }`}>Indonesia</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            theme === 'dark' ? 'bg-gray-800 text-blue-400' : 'bg-blue-50 text-blue-600'
                          }`}>
                            <Type size={24} />
                          </div>
                          <div>
                            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Ukuran Teks</p>
                            <p className="text-sm text-gray-500">Sesuaikan ukuran teks untuk kenyamanan membaca.</p>
                          </div>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                          theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                        }`}>Sedang</span>
                      </div>
                    </div>
                  </section>

                  <div className={`h-px ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`} />

                  {/* MODEL AI */}
                  <section>
                    <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-8 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Model AI</h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            theme === 'dark' ? 'bg-gray-800 text-blue-400' : 'bg-blue-50 text-blue-600'
                          }`}>
                            <Sparkles size={24} />
                          </div>
                          <div>
                            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Model Standar</p>
                            <p className="text-sm text-gray-500">Menggunakan model AI standar untuk penulisan akademik.</p>
                          </div>
                        </div>
                        <span className="px-4 py-1.5 bg-green-100 text-green-600 text-xs font-bold rounded-full">Aktif</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            theme === 'dark' ? 'bg-gray-800 text-blue-400' : 'bg-blue-50 text-blue-600'
                          }`}>
                            <Bot size={24} />
                          </div>
                          <div>
                            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>AI Academic Mode</p>
                            <p className="text-sm text-gray-500">Mode akademik untuk skripsi, proposal, dan makalah.</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setAcademicMode(!academicMode)}
                          className={`w-14 h-7 rounded-full relative transition-all duration-500 ${
                            academicMode ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-500 ${
                            academicMode ? 'left-8' : 'left-1'
                          }`} />
                        </button>
                      </div>
                    </div>
                  </section>

                  <div className={`h-px ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`} />

                  {/* AKADEMIK */}
                  <section>
                    <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-8 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Akademik</h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            theme === 'dark' ? 'bg-gray-800 text-blue-400' : 'bg-blue-50 text-blue-600'
                          }`}>
                            <ShieldCheck size={24} />
                          </div>
                          <div>
                            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Pengecekan Plagiarisme</p>
                            <p className="text-sm text-gray-500">Periksa tingkat kemiripan tulisan akademik.</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setPlagiarism(!plagiarism)}
                          className={`w-14 h-7 rounded-full relative transition-all duration-500 ${
                            plagiarism ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-500 ${
                            plagiarism ? 'left-8' : 'left-1'
                          }`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            theme === 'dark' ? 'bg-gray-800 text-blue-400' : 'bg-blue-50 text-blue-600'
                          }`}>
                            <Share2 size={24} />
                          </div>
                          <div>
                            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Ide Penelitian Interdisipliner</p>
                            <p className="text-sm text-gray-500">Gabungkan ide dari berbagai bidang ilmu.</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setInterdisciplinary(!interdisciplinary)}
                          className={`w-14 h-7 rounded-full relative transition-all duration-500 ${
                            interdisciplinary ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-500 ${
                            interdisciplinary ? 'left-8' : 'left-1'
                          }`} />
                        </button>
                      </div>
                    </div>
                  </section>

                  <div className={`h-px ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`} />

                  {/* SISTEM */}
                  <section>
                    <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-8 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Sistem</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          theme === 'dark' ? 'bg-gray-800 text-blue-400' : 'bg-blue-50 text-blue-600'
                        }`}>
                          <Info size={24} />
                        </div>
                        <div>
                          <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Versi Aplikasi</p>
                          <p className="text-sm text-gray-500">Aplikasi masih dalam tahap pengembangan.</p>
                        </div>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                        theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                      }`}>v1.0 Beta</span>
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
