import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Chrome, AlertCircle, Zap, MapPin, Mic } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { googleSignIn } = useAuth();
    const navigate = useNavigate();

    async function handleGoogleSignIn() {
        try {
            setError('');
            setLoading(true);
            await googleSignIn();
            navigate('/app');
        } catch (err) {
            setError('Failed to sign in with Google. Check your connection.');
            console.error(err);
        }
        setLoading(false);
    }

    return (
        <div className="min-h-[100dvh] bg-theme flex flex-col items-center justify-center p-4 text-theme-main font-sans relative overflow-hidden">
            {/* Ambient Background Elements */}
            <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-primary/20 blur-[100px] rounded-full animate-pulse -z-10" />
            <div className="absolute bottom-[-5%] left-[-5%] w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full -z-10" />

            <div className="w-full max-w-sm bg-surface-soft/80 border border-theme p-8 rounded-[2.5rem] backdrop-blur-2xl relative shadow-2xl">
                <div className="flex flex-col items-center mb-10">
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,211,238,0.4)]"
                    >
                        <Shield className="text-slate-950" size={32} />
                    </motion.div>
                    <h1 className="text-4xl font-black tracking-tighter mb-1 uppercase italic text-transparent bg-clip-text bg-gradient-to-br from-textMain to-textMuted">
                        SafeWalk
                    </h1>
                    <p className="text-theme-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Personal Guardian Platform</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-xs font-medium animate-in fade-in slide-in-from-top-2">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="space-y-8">
                    {/* Micro Features Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { icon: <Zap size={16} />, label: "Predict" },
                            { icon: <MapPin size={16} />, label: "Grid" },
                            { icon: <Mic size={16} />, label: "Sentry" }
                        ].map((f, i) => (
                            <div key={i} className="flex flex-col items-center gap-2 p-3 bg-surface rounded-2xl border border-theme">
                                <div className="text-primary/70">{f.icon}</div>
                                <span className="text-[7px] font-black uppercase tracking-widest text-theme-muted">{f.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4">
                        <p className="text-center text-theme-muted text-sm px-2 leading-relaxed">
                            Sign in to activate your real-time safety grid and AI monitoring.
                        </p>

                        <button 
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="w-full py-5 bg-white text-slate-950 font-black rounded-3xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 shadow-xl"
                        >
                            <Chrome size={20} />
                            <span className="text-base">Continue with Google</span>
                        </button>
                    </div>
                </div>

                <p className="mt-10 text-center text-theme-muted text-[10px] leading-relaxed">
                    By continuing, you agree to the <br/>
                    <span className="text-theme-main underline decoration-theme">Terms of Service</span> & <span className="text-theme-main underline decoration-theme">Privacy Policy</span>
                </p>
            </div>
            
            <div className="mt-12 h-1 w-24 bg-surface rounded-full opacity-40" />
        </div>
    );
}
