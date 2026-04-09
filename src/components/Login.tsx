import React from 'react';
import { motion } from 'motion/react';
import { LogIn, ChevronRight, Sparkles, ShieldCheck, Zap, Globe } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
  isLoggingIn?: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, isLoggingIn }) => {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-[#00E5B0]/30">
      {/* Navigation Header */}
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-8 md:px-16 sticky top-0 z-50">
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
          <button 
            onClick={onLogin} 
            disabled={isLoggingIn}
            className="text-gray-900 font-semibold hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            Dashboard
          </button>
          <a href="#features" className="text-gray-500 hover:text-gray-900 transition-colors">Fitur</a>
        </nav>

        <button 
          onClick={onLogin}
          disabled={isLoggingIn}
          className="bg-[#00C192] hover:bg-[#00A87F] text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#00C192]/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingIn ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <LogIn size={18} />
          )}
          {isLoggingIn ? 'Memproses...' : 'Login'}
        </button>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-[#001B3D] to-[#000D1F] pt-20 pb-32 px-6 overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00E5B0]/5 blur-[120px] rounded-full"></div>
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[#FFD700] text-sm font-bold mb-8 backdrop-blur-sm"
          >
            <Sparkles size={16} />
            <span>BUNTU SAAT MENULIS?</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-7xl font-extrabold text-[#00E5B0] leading-tight mb-8 tracking-tight"
          >
            Cara Membuat Karya Tulis 10x<br />
            <span className="text-white">Lebih Cepat & Berkualitas!</span> 🔥
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[#FFA500] text-lg md:text-2xl font-medium max-w-3xl mx-auto mb-12"
          >
            160+ Tools AI untuk membuat makalah, jurnal, skripsi, laporan, dll <span className="text-white underline decoration-[#00E5B0] underline-offset-4">dalam hitungan menit!</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-6"
          >
            <button
              onClick={onLogin}
              disabled={isLoggingIn}
              className="bg-[#00E5B0] text-[#001B3D] px-12 py-5 rounded-full font-black text-xl shadow-2xl shadow-[#00E5B0]/30 hover:bg-white hover:scale-105 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                <div className="w-6 h-6 border-3 border-[#001B3D] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Mulai Sekarang Gratis
                  <ChevronRight size={24} />
                </>
              )}
              {isLoggingIn && 'Sedang Memuat...'}
            </button>
            
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#00E5B0]" />
              Login aman dengan Google Authentication
            </p>
          </motion.div>

          {/* MacBook Mockup */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-24 relative mx-auto max-w-5xl"
          >
            <div className="relative bg-gray-800 rounded-t-[2.5rem] p-3 shadow-2xl border-x-[6px] border-t-[6px] border-gray-700/50">
              <div className="bg-white rounded-2xl overflow-hidden aspect-[16/10] shadow-inner flex">
                {/* Sidebar Mockup */}
                <div className="w-56 bg-gray-50 border-r border-gray-100 hidden md:flex flex-col p-6 gap-6 text-left">
                  <div className="h-6 bg-gray-200 rounded-lg w-3/4 mb-4"></div>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gray-200 rounded-md"></div>
                      <div className="h-3 bg-gray-200 rounded-full w-full"></div>
                    </div>
                  ))}
                </div>
                {/* Content Mockup */}
                <div className="flex-1 bg-white p-8 overflow-hidden">
                  <div className="flex justify-between items-center mb-10">
                    <div className="h-6 bg-gray-100 rounded-lg w-40"></div>
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full"></div>
                      <div className="w-8 h-8 bg-gray-100 rounded-full"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-left">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl mb-4"></div>
                        <div className="h-4 bg-gray-100 rounded-lg w-3/4 mb-3"></div>
                        <div className="h-3 bg-gray-50 rounded-lg w-full"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="h-5 bg-gray-700 rounded-b-2xl w-full relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-gray-600 rounded-b-xl"></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Kenapa Memilih BimTEKs AI?</h2>
            <p className="text-gray-500 text-lg">Solusi cerdas untuk produktivitas akademik Anda.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-[#00E5B0] transition-colors group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#00E5B0] shadow-sm mb-6 group-hover:bg-[#00E5B0] group-hover:text-white transition-all">
                <Zap size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Super Cepat</h3>
              <p className="text-gray-600 leading-relaxed">Selesaikan draf makalah atau kerangka skripsi hanya dalam hitungan detik, bukan hari.</p>
            </div>

            <div className="p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-[#00E5B0] transition-colors group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#00E5B0] shadow-sm mb-6 group-hover:bg-[#00E5B0] group-hover:text-white transition-all">
                <Globe size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Akses Dimana Saja</h3>
              <p className="text-gray-600 leading-relaxed">Aplikasi berbasis cloud yang bisa diakses dari perangkat apapun, kapanpun Anda butuhkan.</p>
            </div>

            <div className="p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-[#00E5B0] transition-colors group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#00E5B0] shadow-sm mb-6 group-hover:bg-[#00E5B0] group-hover:text-white transition-all">
                <ShieldCheck size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Aman & Terpercaya</h3>
              <p className="text-gray-600 leading-relaxed">Data Anda aman dengan enkripsi standar industri dan autentikasi Google yang terpercaya.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-black text-white px-3 py-1 rounded-md font-bold text-lg">BIMTEKS AI</div>
            <p className="text-gray-400 text-sm">© 2026 BimTEKs.ID. All rights reserved.</p>
          </div>
          
          <div className="flex gap-8 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
