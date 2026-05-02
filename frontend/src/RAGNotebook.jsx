import React, { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Settings, Send, Plus, MessageSquare, FileText, Loader2, Menu, X } from "lucide-react";
import axios from "axios";
import { useClerk, useAuth, useUser } from "@clerk/clerk-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function RAGNotebook() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const { signOut } = useClerk();
  const { userId } = useAuth();
  const { user } = useUser();
  
  const [chats, setChats] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I'm ready to help you with questions about your uploaded content. What would you like to know?",
    },
  ]);
  const [question, setQuestion] = useState("");
  const messagesEndRef = useRef(null);
  const skipFetchRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const apiHeaders = {
    "Content-Type": "application/json",
    "x-user-id": userId
  };

  const multipartHeaders = {
    "x-user-id": userId
  };

  useEffect(() => {
    if (userId) {
      fetchChats();
      fetchDocuments();
    }
  }, [userId]);

  useEffect(() => {
    if (currentChatId) {
      if (skipFetchRef.current) {
        skipFetchRef.current = false;
        return;
      }
      fetchChatMessages(currentChatId);
    } else {
      setMessages([
        {
          role: "assistant",
          content: "Hello! I'm ready to help you with questions about your uploaded content. What would you like to know?",
        },
      ]);
    }
  }, [currentChatId]);

  async function fetchChats() {
    try {
      const res = await axios.get(`${backendUrl}/api/chats`, { headers: apiHeaders });
      setChats(res.data.chats || []);
    } catch (err) {
      console.error("Error fetching chats", err);
    }
  }

  async function fetchChatMessages(chatId) {
    try {
      const res = await axios.get(`${backendUrl}/api/chats/${chatId}`, { headers: apiHeaders });
      if (res.data.messages) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error("Error fetching chat messages", err);
    }
  }

  async function fetchDocuments() {
    try {
      const res = await axios.get(`${backendUrl}/api/documents`, { headers: apiHeaders });
      setDocuments(res.data.documents || []);
    } catch (err) {
      console.error("Error fetching documents", err);
    }
  }

  /* ---------------- PDF HANDLING ---------------- */
  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected) return;

    const allowed = /\.(pdf|csv|xlsx|xls)$/i;
    if (!allowed.test(selected.name) && 
        selected.type !== "application/pdf" && 
        selected.type !== "text/csv" &&
        !selected.type.includes("spreadsheetml") && 
        !selected.type.includes("excel")) {
      alert("Only PDF, CSV, and Excel files are allowed");
      return;
    }

    setFile(selected);
  }

  function handleClearAll() {
    setFile(null);
    setText("");
    setYoutubeUrl("");
  }

  function handleNewChat() {
    setCurrentChatId(null);
  }

  async function handleUploadToKnowledgeBase() {
    if (!file && !text.trim() && !youtubeUrl.trim()) {
      alert("Please upload a PDF, add text content, or provide a YouTube URL");
      return;
    }

    const formData = new FormData();
    if (file) formData.append("file", file);
    if (text) formData.append("text", text);
    if (youtubeUrl) formData.append("youtubeUrl", youtubeUrl);

    setIsUploading(true);
    try {
      const res = await axios.post(`${backendUrl}/api/upload`, formData, { headers: multipartHeaders });
      if (res.data.success) {
        alert(res.data.message);
        handleClearAll();
        fetchDocuments(); // Refresh document list
      } else {
        alert("error uploading data");
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        alert(`Error: ${err.response.data.error}`);
      } else {
        alert("Upload failed. Please check the server connection.");
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSend() {
    if (!question.trim()) return;

    const userMsg = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    const currentQ = question;
    setQuestion("");

    try {
      setIsSending(true);
      const payload = { question: currentQ };
      if (currentChatId) {
        payload.chatId = currentChatId;
      }

      const response = await axios.post(`${backendUrl}/api/chat`, payload, { headers: apiHeaders });
      
      if (response.data.error) {
        console.log(response.data.error);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.data.answer || "No response" },
      ]);

      if (!currentChatId && response.data.chatId) {
        skipFetchRef.current = true;
        setCurrentChatId(response.data.chatId);
        fetchChats(); // Refresh chat list
      }

    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error fetching response" },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="h-screen flex bg-black text-white overflow-hidden font-sans">
      
      {/* SIDEBAR OVERLAY FOR MOBILE */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-20 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`w-64 border-r border-white/5 bg-zinc-950 flex flex-col h-full overflow-hidden absolute lg:relative z-30 transform transition-transform duration-300 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-4 border-b border-white/5 flex justify-between items-center lg:block">
           <button 
             onClick={() => { handleNewChat(); setIsSidebarOpen(false); }}
             className="flex-1 flex items-center gap-2 justify-center bg-white text-black py-2.5 px-4 rounded-lg font-semibold hover:bg-zinc-200 transition active:scale-95"
           >
             <Plus size={16} /> New Chat
           </button>
           <button 
             onClick={() => setIsSidebarOpen(false)}
             className="lg:hidden ml-2 p-2 text-zinc-500 hover:text-white bg-zinc-900 rounded-lg"
           >
             <X size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          <div>
            <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-3 px-2">Chats</h3>
            <div className="space-y-1">
              {chats.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setCurrentChatId(c.id); setIsSidebarOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate flex items-center gap-2 transition ${currentChatId === c.id ? 'bg-white text-black shadow-lg font-medium' : 'hover:bg-zinc-900 text-zinc-400'}`}
                >
                  <MessageSquare size={14} />
                  {c.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-3 px-2">Your Documents</h3>
            <div className="space-y-1">
              {documents.map(d => (
                <div key={d.id} className="px-3 py-2.5 rounded-lg text-sm truncate flex items-center gap-2 text-zinc-400 border border-transparent hover:border-white/10 hover:bg-white/5 transition">
                  <FileText size={14} className="text-white shrink-0" />
                  <span className="truncate" title={d.filename}>{d.filename}</span>
                </div>
              ))}
              {documents.length === 0 && (
                <p className="text-xs text-zinc-700 italic px-2">No documents yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{user?.firstName ? user.firstName[0].toUpperCase() : 'U'}</span>
            )}
          </div>
          <span className="text-xs font-medium text-zinc-400 truncate">
            {user?.fullName || user?.username || "User Session"}
          </span>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full bg-black w-full lg:w-auto">
        
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 lg:px-6 py-4 border-b border-white/5 bg-black/80 backdrop-blur z-10 shrink-0">
          <div className="flex items-center gap-3 font-bold text-lg text-white">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition"
            >
              <Menu size={20} />
            </button>
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center hidden sm:flex">
              R
            </div>
            ReTriVo
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => signOut()}
              className="flex items-center gap-2 text-sm lg:text-base px-3 py-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition border border-transparent hover:border-white/10"
            >
              <X size={16} /> Sign Out
            </button>
          </div>
        </header>

        {/* Workspace */}
        <main className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-3 md:gap-6 p-3 md:p-6 min-h-0 container mx-auto max-w-7xl overflow-y-auto md:overflow-hidden">
          
          {/* LEFT PANEL: KNOWLEDGE BASE CONTROLS */}
          <section className="bg-zinc-950 rounded-xl border border-white/5 p-3 sm:p-4 md:p-6 flex flex-col shadow-2xl min-h-[360px] md:min-h-0 md:overflow-hidden shrink-0">
            <div>
              <h2 className="font-bold text-lg text-white">Knowledge Base Builder</h2>
              <p className="text-sm text-zinc-600 mt-1">
                Upload context to make your assistant smarter.
              </p>
            </div>

            <div className="mt-4 md:mt-6 flex gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-white/10 hover:bg-white text-white hover:text-black font-medium cursor-pointer transition-all duration-300">
                <Upload size={16} /> <span className="font-semibold text-sm">Browse Files</span>
                <input type="file" accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" hidden onChange={handleFileChange} />
              </label>

              <button
                onClick={handleClearAll}
                className="px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-white/10 text-zinc-600 hover:text-white hover:border-white transition-all duration-300 shadow-sm"
                title="Clear file and text"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {file && (
              <div className="mt-4 flex items-center justify-between bg-white/5 px-4 py-3 rounded-lg border border-white/10 text-sm animate-in fade-in zoom-in duration-300">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="truncate text-white font-medium">
                    {file.name}
                  </div>
                </div>
                <button onClick={() => setFile(null)} className="text-zinc-600 hover:text-white ml-2">✕</button>
              </div>
            )}

            <div className="mt-4 md:mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white text-xs uppercase tracking-widest">YouTube Video</h3>
              </div>
              <input
                type="text"
                className="w-full p-3 sm:p-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-800 focus:outline-none focus:border-white transition-all duration-300 font-sans"
                placeholder="Paste YouTube URL here..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
              />
            </div>

            <div className="mt-4 md:mt-6 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white text-xs uppercase tracking-widest">Raw Text Content</h3>
                <span className="text-[10px] font-mono text-zinc-700 bg-white/5 px-2 py-0.5 rounded">{text.length || 0} chars</span>
              </div>

              <textarea
                className="flex-1 w-full p-3 sm:p-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-800 focus:outline-none focus:border-white transition-all duration-300 resize-none font-sans min-h-[120px] md:min-h-0"
                placeholder="Paste articles, notes, or any text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            <button
              onClick={handleUploadToKnowledgeBase}
              disabled={isUploading || (!file && !text.trim() && !youtubeUrl.trim())}
              className="mt-4 md:mt-6 w-full bg-white text-black font-bold px-4 py-3 sm:py-3.5 rounded-xl hover:bg-zinc-200 shadow-xl transition transform active:scale-[0.98] disabled:opacity-20 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm sm:text-base"
            >
              {isUploading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processing...
                </>
              ) : (
                "Add to Vector Database"
              )}
            </button>
          </section>

          {/* RIGHT PANEL: CHAT SESSION */}
          <section className="bg-zinc-950 rounded-xl border border-white/5 p-0 flex flex-col shadow-2xl min-h-[450px] md:min-h-0 md:overflow-hidden shrink-0">
            
            <div className="p-4 border-b border-white/5 bg-black/40 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg text-white">Assistant Chat</h2>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
                  {currentChatId ? 'Memory Active' : 'New Session'}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-8">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 sm:gap-4 max-w-[92%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg font-bold text-xs sm:text-sm ${msg.role === 'user' ? 'bg-white text-black' : 'bg-zinc-900 text-white border border-white/10'}`}>
                      {msg.role === 'user' ? 'U' : 'AI'}
                    </div>

                    <div
                      className={`p-3 sm:p-5 rounded-2xl text-sm sm:text-[15px] leading-relaxed shadow-xl border
                        ${
                          msg.role === "user"
                            ? "bg-white text-black border-transparent font-medium rounded-tr-sm"
                            : "bg-zinc-900/50 text-white border-white/5 rounded-tl-sm backdrop-blur-sm"
                        }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm sm:prose-base max-w-none break-words leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="flex gap-2 sm:gap-4 max-w-[92%] flex-row">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 bg-zinc-900 text-white border border-white/10 shadow-lg font-bold text-xs sm:text-sm">
                      AI
                    </div>
                    <div className="p-3 sm:p-5 rounded-2xl text-sm sm:text-[15px] leading-relaxed shadow-xl bg-zinc-900/50 text-white border-white/5 rounded-tl-sm flex items-center gap-3 backdrop-blur-sm">
                       <Loader2 size={16} className="animate-spin text-white" />
                       <span className="text-zinc-500 font-mono text-xs animate-pulse">Computing Inference...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-2.5 sm:p-4 bg-black/40 border-t border-white/5 backdrop-blur-xl">
              <div className="flex items-end gap-3 bg-zinc-900/50 border border-white/10 focus-within:border-white rounded-2xl p-2.5 transition-all duration-300 group">
                <textarea
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none resize-none min-h-[44px] max-h-[150px] font-sans"
                  placeholder="Ask a question about your knowledge..."
                  rows={1}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />

                <button
                  onClick={handleSend}
                  disabled={!question.trim() || isSending}
                  className="w-11 h-11 shrink-0 bg-white text-black rounded-xl flex items-center justify-center hover:bg-zinc-200 transition-all shadow-lg active:scale-90 disabled:opacity-10 disabled:grayscale"
                >
                  {isSending ? (
                     <Loader2 size={20} className="animate-spin" />
                  ) : (
                     <Send size={20} className="translate-x-[-1px] translate-y-[1px]" />
                  )}
                </button>
              </div>
              <div className="text-center mt-3 text-[9px] text-zinc-700 font-bold uppercase tracking-[0.2em]">
                Secure Inference Session
              </div>
            </div>

          </section>

        </main>
      </div>
    </div>
  );
}
