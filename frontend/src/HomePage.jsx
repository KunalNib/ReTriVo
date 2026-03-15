import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, FileSearch, MessageSquareText, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative font-sans">
      {/* Background decoration removed for extreme minimalism */}
      
      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-white text-black shadow-xl flex items-center justify-center font-bold text-xl">
            R
          </div>
          <span className="font-semibold text-xl tracking-tight">ReTriVo</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-zinc-500">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#how-it-works" className="hover:text-white transition">How it Works</a>
          <button 
            onClick={() => navigate('/notebook')}
            className="px-5 py-2.5 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition-transform active:scale-95"
          >
            Launch Notebook
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-32 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white mb-8 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Powered by Gemini 2.5 Flash & Qdrant Vector Search
        </div>
        
        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-8 leading-tight">
          Talk to your <br />
          <span className="text-white">
            Documents
          </span>
        </h1>
        
        <p className="max-w-2xl mx-auto text-xl text-zinc-500 mb-12 leading-relaxed">
          Upload your PDFs and text content. Instantly build a personalized knowledge base and ask questions to unlock deep insights using advanced AI.
        </p>

        <div className="flex items-center justify-center gap-4">
          <button 
            onClick={() => navigate('/notebook')}
            className="px-8 py-4 rounded-full bg-white text-black font-semibold text-lg hover:bg-zinc-200 transition-all hover:-translate-y-1 active:scale-95 flex items-center gap-2"
          >
            <MessageSquareText size={20} />
            Start Chatting Now
          </button>
        </div>
      </main>

      {/* Features Grid */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-8">
          
          <div className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-colors group">
            <div className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <FileSearch size={28} />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Vector Semantic Search</h3>
            <p className="text-zinc-500 leading-relaxed">
              We chunk and embed your documents into Qdrant using state-of-the-art text-embedding-004 models.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-colors group">
            <div className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <BrainCircuit size={28} />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Gemini 2.5 Intelligence</h3>
            <p className="text-zinc-500 leading-relaxed">
              Experience blazing fast and nuanced answers powered by Google's latest Gemini 2.5 Flash architecture.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-colors group">
            <div className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck size={28} />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Isolated User Data</h3>
            <p className="text-zinc-500 leading-relaxed">
              Your vectors and chat history are securely isolated. You only ever search against your own uploaded knowledge.
            </p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-zinc-600 mt-20">
        <div className="flex items-center gap-2 justify-center mb-2">
           <div className="w-5 h-5 rounded bg-white text-[10px] text-black flex items-center justify-center font-bold">R</div>
           <span className="font-semibold text-white">ReTriVo</span>
        </div>
        <p className="text-sm">Built with React, Express, and Qdrant.</p>
      </footer>
    </div>
  );
}
