import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Chrome, AlertCircle } from 'lucide-react';

export default function Register() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { googleSignIn } = useAuth();
    const navigate = useNavigate();

    async function handleGoogleSignIn() {
        try {
            setError('');
            setLoading(true);
            await googleSignIn();
            navigate('/onboarding');
        } catch (err) {
            setError('Failed to initialize account with Google.');
            console.error(err);
        }
        setLoading(false);
    }

    return (
        <div className="min-h-[100dvh] bg-theme flex flex-col items-center justify-center p-4 text-theme-main font-sans">
            <div className="w-full max-w-sm bg-surface-soft/80 border border-theme p-8 rounded-[2.5rem] backdrop-blur-2xl relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[80px] -z-10" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 blur-[80px] -z-10" />
                
                <div className="flex flex-col items-center mb-12">
                    <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                        <Shield className="text-white" size={32} />
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter mb-2 uppercase italic text-transparent bg-clip-text bg-gradient-to-br from-textMain to-textMuted">
                        Join Grid
                    </h1>
                    <p className="text-theme-muted text-xs font-bold uppercase tracking-[0.2em] opacity-75">Personal Guardian</p>
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-xs font-medium animate-in fade-in slide-in-from-top-2">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="space-y-6">
                    <p className="text-center text-theme-muted text-sm px-4 leading-relaxed">
                        Create your secure profile and activate AI protection instantly using your Google identity.
                    </p>

                    <button 
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full py-5 bg-primary text-white font-black rounded-3xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 shadow-xl"
                    >
                        <Chrome size={20} />
                        <span className="text-base">Sign Up with Google</span>
                    </button>
                </div>

                <p className="mt-12 text-center text-theme-muted text-sm font-medium">
                    Already protected? <Link to="/login" className="text-primary font-bold hover:underline underline-offset-4">Login</Link>
                </p>
            </div>
            
            <Link to="/landing" className="mt-10 text-theme-muted text-[10px] font-black hover:text-theme-main transition-colors uppercase tracking-[0.3em]">← System Showcase</Link>
        </div>
    );
}
