import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Chrome, ArrowRight, Zap, MapPin, Mic } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Landing() {
    const { googleSignIn } = useAuth();
    const navigate = useNavigate();

    async function handleStart() {
        try {
            await googleSignIn();
            navigate('/app');
        } catch (err) {
            console.error(err);
            navigate('/login');
        }
    }

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden bg-theme text-theme-main">
            {/* Ambient Background */}
            <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-5%] left-[-5%] w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
            
            {/* Header / Logo */}
            <div className="pt-12 px-8 flex flex-col items-center">
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-16 h-16 bg-primary rounded-[2rem] flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.4)] mb-6"
                >
                    <Shield className="text-white" size={32} />
                </motion.div>
                <h1 className="text-3xl font-black uppercase tracking-tighter italic">SafeWalk</h1>
                <p className="text-[10px] font-black tracking-[0.4em] uppercase text-theme-muted mt-2">AI Guardian Platform</p>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col justify-center px-8 pb-12">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <h2 className="text-5xl font-black leading-[0.9] tracking-tight mb-6">
                        Walk With <br/>
                        <span className="text-primary italic">Confidence.</span>
                    </h2>
                    <p className="text-theme-muted text-base font-medium leading-relaxed mb-10 pr-4">
                        Real-time AI risk analysis, stealth SOS triggers, and a living safety grid—all in your pocket.
                    </p>
                </motion.div>

                {/* Micro Features */}
                <div className="grid grid-cols-3 gap-4 mb-12">
                    {[
                        { icon: <Zap size={18} />, label: "Predict" },
                        { icon: <MapPin size={18} />, label: "Grid" },
                        { icon: <Mic size={18} />, label: "Sentry" }
                    ].map((f, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 p-4 bg-surface-soft rounded-2xl border border-theme">
                            <div className="text-primary">{f.icon}</div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-theme-muted">{f.label}</span>
                        </div>
                    ))}
                </div>

                {/* Primary CTA */}
                <div className="space-y-4">
                    <button 
                        onClick={handleStart}
                        className="w-full py-5 bg-primary text-white font-black rounded-3xl flex items-center justify-center gap-3 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        <Chrome size={20} />
                        <span>Get Started with Google</span>
                        <ArrowRight size={18} className="ml-1 opacity-50" />
                    </button>
                    
                    <button 
                        onClick={() => navigate('/login')}
                        className="w-full py-4 text-theme-muted text-xs font-bold uppercase tracking-widest hover:text-theme-main transition-colors"
                    >
                        Existing Account? Login
                    </button>
                </div>
            </div>

            {/* Bottom Accent */}
            <div className="h-2 w-32 bg-surface rounded-full mx-auto mb-4 opacity-35" />
        </div>
    );
}
