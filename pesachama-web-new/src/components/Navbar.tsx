"use client";

import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Button from "./Button";
import { ThemeToggle } from "./ThemeToggle";
import { RatibuLogo } from "./RatibuLogo";
import { supabase } from "../lib/supabase";
import { User, LayoutDashboard, ArrowLeft } from "lucide-react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  };

  const handleCreateChama = () => {
    if (user) {
      navigate('/create-chama');
    } else {
      navigate('/login?redirectTo=/create-chama');
    }
  };

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 py-4 px-6 font-sans">
      <div className="max-w-7xl mx-auto px-6 py-2 flex justify-between items-center glass rounded-2xl border border-white/5 shadow-2xl animate-fade-in transition-all duration-500">
        {/* Left Side: Logo or Back to Home */}
        <div className="flex items-center gap-4">
          {isAuthPage && (
            <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mr-2">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
          )}
          <Link to="/" className="flex items-center group">
            <RatibuLogo className="h-10 md:h-16 w-auto text-white group-hover:scale-105 transition-transform" />
            <div className="ml-2 md:ml-4 h-6 md:h-8 w-px bg-white/10 hidden sm:block" />
            <div className="ml-2 md:ml-4 hidden sm:flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00C853]">Ratibu</span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Digital Banking</span>
            </div>
          </Link>
        </div>

        {/* Desktop Links (Only shown on landing pages) */}
        {!isAuthPage && (
          <nav className="hidden md:flex items-center space-x-1">
            {["Features", "Solutions", "Pricing", "Resources", "Chamas"].map((item) => (
              <Link
                key={item}
                to={`/${item.toLowerCase()}`}
                className="px-4 py-2 text-sm font-bold text-[#00C853] hover:text-[#00C853]/80 hover:bg-white/5 rounded-lg transition-all"
              >
                {item}
              </Link>
            ))}
          </nav>
        )}

        {/* Actions */}
        <div className="hidden md:flex items-center space-x-3">
          <ThemeToggle />
          
          {user ? (
            <div className="flex items-center gap-3">
              <div className="relative group/profile">
                <button className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-[#00C853] border border-[#00C853]/30 overflow-hidden hover:border-[#00C853] transition-all">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                </button>

                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl opacity-0 translate-y-2 invisible group-hover/profile:opacity-100 group-hover/profile:translate-y-0 group-hover/profile:visible transition-all duration-200 overflow-hidden">
                   <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-[#00C853]/10 hover:text-[#00C853] transition-colors">
                      <User className="w-4 h-4" /> Profile
                   </Link>
                   <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-[#00C853]/10 hover:text-[#00C853] transition-colors">
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                   </Link>
                   <div className="h-px bg-slate-100 dark:bg-slate-800" />
                   <button 
                      onClick={() => supabase.auth.signOut()}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                   >
                      <User className="w-4 h-4" /> Logout
                   </button>
                </div>
              </div>
            </div>
          ) : (
            !isAuthPage && (
              <>
                <Link to="/login">
                  <button className="px-6 py-2 rounded-xl font-bold bg-transparent text-[#00C853] border border-[#00C853]/50 hover:bg-[#00C853]/10 hover:border-[#00C853] transition-all duration-300">
                    Login
                  </button>
                </Link>
                <button 
                  onClick={handleCreateChama}
                  className="bg-[#00C853] hover:bg-[#00C853]/90 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-[#00C853]/20 hover:shadow-[#00C853]/40"
                >
                    Get Started
                </button>
              </>
            )
          )}
        </div>

        {/* Mobile Toggle */}
        {!isAuthPage && (
          <div
            className="md:hidden cursor-pointer text-white p-2 hover:bg-white/5 rounded-lg transition-colors"
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            )}
          </div>
        )}
      </div>

      {/* Mobile Menu */}
      {open && !isAuthPage && (
        <div className="md:hidden mt-3 p-6 glass rounded-2xl border border-white/5 shadow-2xl animate-slide-up flex flex-col space-y-4">
          {["Features", "Solutions", "Pricing", "Resources", "Chamas"].map((item) => (
            <Link
              key={item}
              to={`/${item.toLowerCase()}`}
              onClick={() => setOpen(false)}
              className="text-lg font-bold text-slate-300 hover:text-[#00C853] transition-colors"
            >
              {item}
            </Link>
          ))}
          <div className="h-px bg-white/5 my-2" />
          <div className="grid grid-cols-1 gap-4">
            {user ? (
               <Link to="/dashboard" onClick={() => setOpen(false)}>
                  <Button className="w-full">Dashboard</Button>
               </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)}>
                  <Button variant="secondary" className="w-full">Login</Button>
                </Link>
                <button onClick={() => { setOpen(false); handleCreateChama(); }}>
                  <Button className="w-full">Get Started</Button>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
