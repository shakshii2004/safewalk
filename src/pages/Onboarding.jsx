import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Shield, Phone, MapPin, CheckCircle2, ArrowRight, ArrowLeft, Mic, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Onboarding() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        guardianPhone: '',
        homeAddress: '',
        homeCoords: null,
        enableVoice: true,
        enableStealth: false
    });
    const [loading, setLoading] = useState(false);

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const finishOnboarding = async () => {
        setLoading(true);
        try {
            await setDoc(doc(db, 'users', user.uid), {
                ...formData,
                onboarded: true,
                createdAt: new Date().toISOString(),
                email: user.email
            });
            // Also update localStorage for backward compatibility if needed
            localStorage.setItem('sw-guardian', formData.guardianPhone);
            if (formData.homeCoords) localStorage.setItem('sw-home-location', JSON.stringify(formData.homeCoords));
            
            navigate('/app');
        } catch (err) {
            console.error("Failed to save onboarding data:", err);
            alert("Error saving settings. Please try again.");
        }
        setLoading(false);
    };

    const handleLocationSelect = () => {
        // Mocking location selection for onboarding flow
        navigator.geolocation.getCurrentPosition((pos) => {
            setFormData({
                ...formData,
                homeCoords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
                homeAddress: 'Current Location'
            });
        });
    };

    const steps = [
        {
            title: "Emergency Guardian",
            icon: <Phone size={32} />,
            content: (
                <div className="space-y-6">
                    <p className="text-theme-muted text-sm">Who should we notify if you are in danger? This person will receive your live GPS coordinates.</p>
                    <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted group-focus-within:text-primary transition-colors" size={18} />
                        <input 
                            type="tel" 
                            placeholder="Guardian Phone Number"
                            className="w-full bg-surface border border-theme rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary transition-all text-sm font-medium text-theme-main"
                            value={formData.guardianPhone}
                            onChange={(e) => setFormData({...formData, guardianPhone: e.target.value})}
                        />
                    </div>
                </div>
            )
        },
        {
            title: "Safe Zone",
            icon: <Home size={32} />,
            content: (
                <div className="space-y-6">
                    <p className="text-theme-muted text-sm">Set your home coordinates. SafeWalk will automatically suggest monitoring if you leave this zone at night.</p>
                    <button 
                        onClick={handleLocationSelect}
                        className={`w-full py-4 border-2 border-dashed rounded-2xl flex items-center justify-center gap-3 transition-all ${formData.homeCoords ? 'border-safe bg-safe/5 text-safe' : 'border-theme text-theme-muted hover:border-primary/50'}`}
                    >
                        {formData.homeCoords ? <CheckCircle2 size={20} /> : <MapPin size={20} />}
                        <span className="font-bold">{formData.homeCoords ? 'Safe Zone Locked' : 'Use Current Location as Home'}</span>
                    </button>
                    {formData.homeCoords && <p className="text-center text-[10px] text-theme-muted uppercase tracking-widest font-black">Coordinates calibrated successfully</p>}
                </div>
            )
        },
        {
            title: "Guardian AI Tools",
            icon: <Mic size={32} />,
            content: (
                <div className="space-y-4">
                    <p className="text-theme-muted text-sm mb-4 text-center">Enable advanced predictive features.</p>
                    
                    <div className="flex items-center justify-between p-4 bg-surface border border-theme rounded-2xl">
                        <div className="flex items-center gap-3">
                            <Mic size={20} className="text-primary" />
                            <div>
                                <h4 className="text-sm font-bold">Voice Sentry</h4>
                                <p className="text-[10px] text-theme-muted">Listen for panic words like "Help"</p>
                            </div>
                        </div>
                        <input type="checkbox" checked={formData.enableVoice} onChange={(e) => setFormData({...formData, enableVoice: e.target.checked})} className="w-5 h-5 accent-primary" />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-surface border border-theme rounded-2xl opacity-50">
                        <div className="flex items-center gap-3">
                            <Shield size={20} className="text-coral" />
                            <div>
                                <h4 className="text-sm font-bold">Stealth Mode</h4>
                                <p className="text-[10px] text-theme-muted">Mask app as a news reader</p>
                            </div>
                        </div>
                        <input type="checkbox" checked={formData.enableStealth} onChange={(e) => setFormData({...formData, enableStealth: e.target.checked})} className="w-5 h-5 accent-coral" />
                    </div>
                </div>
            )
        },
        {
            title: "Ready for the Grid",
            icon: <Shield size={48} className="text-primary" />,
            content: (
                <div className="text-center space-y-6">
                    <p className="text-theme-muted text-sm">Your safety profile is initialized. SafeWalk is now your predictive guardian.</p>
                    <div className="p-6 bg-primary/5 border border-primary/20 rounded-[2rem] inline-block w-full">
                        <ul className="text-left space-y-3">
                            <li className="flex items-center gap-3 text-xs font-medium"><CheckCircle2 size={16} className="text-safe" /> Guardian Contact Set</li>
                            <li className="flex items-center gap-3 text-xs font-medium"><CheckCircle2 size={16} className="text-safe" /> Home Geofence Calibrated</li>
                            <li className="flex items-center gap-3 text-xs font-medium"><CheckCircle2 size={16} className="text-safe" /> Voice Guardian Active</li>
                        </ul>
                    </div>
                </div>
            )
        }
    ];

    const currentStep = steps[step - 1];

    return (
        <div className="min-h-screen bg-theme flex flex-col items-center justify-center p-4 text-theme-main">
            <div className="w-full max-w-md relative">
                {/* Progress Bar */}
                <div className="flex gap-2 mb-12">
                    {steps.map((_, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i + 1 <= step ? 'bg-primary shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-surface'}`} />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div 
                        key={step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="bg-surface-soft border border-theme p-6 rounded-[2rem] backdrop-blur-xl"
                    >
                        <div className="flex flex-col items-center mb-8">
                            <div className="mb-6 text-primary">{currentStep.icon}</div>
                            <h2 className="text-2xl font-black italic uppercase tracking-tight">{currentStep.title}</h2>
                        </div>

                        {currentStep.content}

                        <div className="flex gap-4 mt-12">
                            {step > 1 && (
                                <button onClick={prevStep} className="flex-1 py-4 bg-surface border border-theme rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-surface-soft transition-all">
                                    <ArrowLeft size={18} /> Back
                                </button>
                            )}
                            <button 
                                onClick={step === steps.length ? finishOnboarding : nextStep}
                                disabled={loading}
                                className="flex-[2] py-4 bg-primary text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-[0_10px_30px_rgba(34,211,238,0.2)] disabled:opacity-50"
                            >
                                {loading ? 'Finalizing...' : (step === steps.length ? 'Start Protecting Me' : 'Continue')} 
                                {step !== steps.length && <ArrowRight size={18} />}
                            </button>
                        </div>
                    </motion.div>
                </AnimatePresence>

                <p className="text-center mt-8 text-[10px] text-theme-muted uppercase font-black tracking-widest">SafeWalk Onboarding Protocol v2.4</p>
            </div>
        </div>
    );
}
