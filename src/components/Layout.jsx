import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import { Moon, Shield, Sun } from 'lucide-react';

export default function Layout() {
    const loc = useLocation();
    const navigate = useNavigate();
    const isSosPage = loc.pathname === '/sos';
    const [theme, setTheme] = useState(() => localStorage.getItem('sw-theme') || 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('sw-theme', theme);
    }, [theme]);

    return (
        <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-theme text-theme-main relative shadow-2xl font-sans overflow-hidden">
            <button
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                className="absolute top-4 right-4 z-[120] w-10 h-10 rounded-full border border-theme bg-surface text-theme-main flex items-center justify-center transition-all active:scale-95"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="flex-1 overflow-hidden w-full" style={{ minHeight: 0 }}>
                <Outlet />
            </div>



            <BottomNav />
        </div>
    );
}
