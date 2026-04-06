import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, ClerkLoading, ClerkLoaded } from '@clerk/clerk-react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import HomePage from './HomePage';
import RAGNotebook from './RAGNotebook';

// Intercepts global Axios requests and route changes to show a top progress bar
function GlobalLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let reqCount = 0;
    
    const reqInterceptor = axios.interceptors.request.use((config) => {
      // Bypass global loader for LLM chat and chat list fetches since they have local spinners
      if (config.url && (config.url.includes('/api/chat') || config.url.includes('/api/chats'))) {
        config.headers['x-bypass-loader'] = 'true';
        return config;
      }
      reqCount++;
      setIsLoading(true);
      return config;
    }, (error) => {
      if (error.config && error.config.headers && error.config.headers['x-bypass-loader']) return Promise.reject(error);
      reqCount--;
      if (reqCount <= 0) { reqCount = 0; setIsLoading(false); }
      return Promise.reject(error);
    });

    const resInterceptor = axios.interceptors.response.use((response) => {
      if (response.config && response.config.headers && response.config.headers['x-bypass-loader']) return response;
      reqCount--;
      if (reqCount <= 0) { reqCount = 0; setIsLoading(false); }
      return response;
    }, (error) => {
      if (error.config && error.config.headers && error.config.headers['x-bypass-loader']) return Promise.reject(error);
      reqCount--;
      if (reqCount <= 0) { reqCount = 0; setIsLoading(false); }
      return Promise.reject(error);
    });

    return () => {
      axios.interceptors.request.eject(reqInterceptor);
      axios.interceptors.response.eject(resInterceptor);
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(false), 400); // short loader on route change
    return () => clearTimeout(t);
  }, [location.pathname]);

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-[2px] bg-white/10 z-[9999] overflow-hidden">
       <div className="w-full h-full bg-white animate-progress-slide shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
    </div>
  );
}

// Centered spinner during initial Clerk authentication resolution
function FullScreenAuthLoader() {
  return (
    <div className="fixed inset-0 bg-black z-[9998] flex flex-col items-center justify-center gap-4 text-white">
      <Loader2 size={32} className="animate-spin text-white/80" />
      <span className="text-xs font-bold tracking-[0.2em] uppercase text-zinc-500">Initializing Session...</span>
    </div>
  );
}

function App() {
  return (
    <Router>
      <ClerkLoading>
        <FullScreenAuthLoader />
      </ClerkLoading>
      <ClerkLoaded>
        <GlobalLoader />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/notebook"
            element={
              <>
                <SignedIn>
                  <RAGNotebook />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
        </Routes>
      </ClerkLoaded>
    </Router>
  );
}

export default App;
