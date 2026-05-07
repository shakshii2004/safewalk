import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Map as MapIcon, ShieldAlert, FileText } from 'lucide-react';

export default function BottomNav() {
    const location = useLocation();

    const navItems = [
        { name: 'Home', path: '/app', icon: <Home size={24} /> },
        { name: 'Map', path: '/app/map', icon: <MapIcon size={24} /> },
        { name: 'SOS', path: '/app/sos', icon: <ShieldAlert size={26} className="text-danger" /> },
        { name: 'Reports', path: '/app/reports', icon: <FileText size={24} /> },
    ];

    return (
        <div className="bg-card-theme w-full h-16 flex justify-around items-center rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.2)] border-t border-theme relative z-50">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <Link
                        key={item.name}
                        to={item.path}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${isActive ? 'text-primary scale-110' : 'text-textMuted hover:text-textMain'
                            }`}
                    >
                        {item.icon}
                        <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
                        {isActive && (
                            <div className="absolute top-0 w-8 h-1 bg-primary rounded-b-full shadow-[0_0_10px_rgba(99,102,241,0.45)]" />
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
