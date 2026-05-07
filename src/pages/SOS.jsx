import React, { useState, useEffect } from 'react';
import { PhoneCall, Shield, Navigation, BellRing, PhoneOff, AlertCircle, Users, LogOut } from 'lucide-react';
import useGeolocation from '../hooks/useGeolocation';
import { triggerSOS, triggerTelegramAlert } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function SOS() {
    const { location } = useGeolocation();
    const { user, logout } = useAuth();
    const [incoming, setIncoming] = useState(false);
    const [status, setStatus] = useState('idle'); 
    const [guardian, setGuardian] = useState('');
    const [incomingCallerName, setIncomingCallerName] = useState('Mom');
    const [isEditingGuardian, setIsEditingGuardian] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const localGuardian = localStorage.getItem('sw-guardian');
        if (localGuardian) setGuardian(localGuardian);

        if (!user) {
            setLoading(false);
            return;
        }

        const fetchGuardian = async () => {
            try {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().guardianPhone) {
                    setGuardian(docSnap.data().guardianPhone);
                    localStorage.setItem('sw-guardian', docSnap.data().guardianPhone);
                }
            } catch (err) {
                console.error("Cloud fetch failed, using local:", err);
            }
            setLoading(false);
        };
        fetchGuardian();
    }, [user]);

    const performFakeCall = () => {
        const callerNames = ['Mom', 'Dad', 'Brother', 'Sister', 'Bestie', 'Aunty', 'Uncle'];
        const randomName = callerNames[Math.floor(Math.random() * callerNames.length)];
        setIncomingCallerName(randomName);
        setTimeout(() => setIncoming(true), 3000);
    };

    const handleRealSOS = async () => {
        setStatus('broadcasting');
        
        // Use location if available, but DO NOT block the emergency alert if GPS is still loading!
        const loc = location || { lat: "Unknown", lng: "Unknown" };

        // 1. Try Telegram Alert FIRST — automatically sends location!
        const telegramSuccess = await triggerTelegramAlert(loc, 100, "");

        // 2. Log to Firestore in the background (DO NOT block the UI)
        triggerSOS(loc, 100, "manual", "no-response").catch(console.error);

        // 3. SMS fallback ONLY if Telegram failed
        if (!telegramSuccess && guardian) {
            const mapsLink = loc.lat !== "Unknown" ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}` : "Location not available";
            const smsBody = encodeURIComponent(`🚨 EMERGENCY SOS! I need help. My live location: ${mapsLink}`);
            window.location.href = `sms:${guardian}?body=${smsBody}`;
        }

        if (telegramSuccess) {
            setStatus('success');
            window.__lastSosLoc = loc;
            setTimeout(() => setStatus('idle'), 8000);
        } else {
            setStatus('error');
            setTimeout(() => setStatus('idle'), 4000);
        }
    };

    const saveGuardian = async (e) => {
        if (e) e.preventDefault();
        
        // 1. Save to local storage immediately (Instant UI update)
        localStorage.setItem('sw-guardian', guardian);
        setIsEditingGuardian(false);

        // 2. Sync to cloud in the background (Non-blocking)
        if (user) {
            setDoc(doc(db, 'users', user.uid), {
                guardianPhone: guardian,
                updatedAt: new Date().toISOString()
            }, { merge: true }).catch(err => {
                console.error("Background cloud sync failed:", err);
            });
        }
    };

    const selectFromContacts = async () => {
        const supported = 'contacts' in navigator && 'ContactsManager' in window;
        if (!supported) {
            alert("Contact picking is not supported in this browser. Please type the number manually.");
            return;
        }

        try {
            const props = ['name', 'tel'];
            const opts = { multiple: false };
            const contacts = await navigator.contacts.select(props, opts);
            
            if (contacts && contacts.length > 0) {
                const contact = contacts[0];
                if (contact.tel && contact.tel.length > 0) {
                    // Clean the phone number (remove spaces, dashes)
                    const rawNum = contact.tel[0].replace(/[^0-9+]/g, '');
                    setGuardian(rawNum);
                }
            }
        } catch (err) {
            console.error("Contact picker error:", err);
        }
    };

    if (incoming) return (
        <div className="h-full w-full bg-background absolute inset-0 z-[100] flex flex-col items-center justify-between py-24 text-theme-main">
            <div className="flex flex-col items-center">
                <span className="text-xl font-medium mb-2">{incomingCallerName}</span>
                <span className="text-sm text-theme-muted mb-8">Emergency Contact</span>
                <div className="w-32 h-32 rounded-full bg-surface-soft flex items-center justify-center mb-8"><span className="text-6xl">🛡️</span></div>
                <span className="text-2xl animate-pulse">Incoming call...</span>
            </div>
            <div className="flex w-full justify-around px-12">
                <button onClick={() => setIncoming(false)} className="w-16 h-16 rounded-full bg-safe flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.5)]"><PhoneCall fill="white" size={28} /></button>
                <button onClick={() => setIncoming(false)} className="w-16 h-16 rounded-full bg-danger flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.5)]"><PhoneOff fill="white" size={28} /></button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col items-center justify-start p-4 h-full text-center relative overflow-y-auto bg-theme text-theme-main">
            <div className="w-full text-left mb-3 mt-2">
                <h1 className="text-3xl font-extrabold text-danger tracking-tight">Emergency</h1>
                <p className="text-textMuted text-xs mt-1 font-medium">Act immediately if you feel unsafe.</p>
            </div>

            <div className="w-full flex flex-col items-center mt-2">
                <div className="relative flex items-center justify-center w-64 h-64">
                    <div className="absolute inset-0 rounded-full animate-pulse-ring pointer-events-none" />
                    <button onClick={handleRealSOS} className="w-48 h-48 rounded-[3rem] bg-danger border-[8px] border-rose-500/50 flex flex-col items-center justify-center shadow-[0_0_60px_rgba(244,63,94,0.6)] active:scale-95 transition-all outline-none z-10">
                        <Shield fill="none" strokeWidth={1.5} className="text-white mb-2" size={48} />
                        <span className="text-white text-4xl font-black tracking-widest">SOS</span>
                    </button>
                </div>
                <p className="text-textMuted text-xs mt-3 px-4 font-medium">Tap to instantly broadcast your GPS coordinates to Telegram and fallback SMS.</p>
            </div>

            <div className="w-full space-y-3 pb-16 mt-3">
                {/* Emergency Guardian Card */}
                <div className="bg-surface-soft backdrop-blur-md rounded-2xl border border-theme p-4 text-left shadow-lg overflow-hidden relative">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Shield size={16} className="text-primary" />
                            <h3 className="text-textMain font-bold text-sm">Emergency Guardian</h3>
                        </div>
                        <button onClick={() => setIsEditingGuardian(!isEditingGuardian)} className="text-primary text-xs font-bold px-2 py-1 bg-primary/10 rounded-md">
                            {isEditingGuardian ? 'Cancel' : (guardian ? 'Edit' : 'Add')}
                        </button>
                    </div>
                    
                    {isEditingGuardian ? (
                        <div className="space-y-3">
                            <form onSubmit={saveGuardian} className="flex gap-2">
                                <input 
                                    type="tel" 
                                    placeholder="Phone number" 
                                    value={guardian}
                                    onChange={(e) => setGuardian(e.target.value)}
                                    className="flex-1 bg-surface border border-theme rounded-lg px-3 py-2 text-sm text-theme-main outline-none focus:border-primary transition-all"
                                    autoFocus
                                />
                                <button type="submit" className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg">Save</button>
                            </form>
                            
                            <button 
                                type="button"
                                onClick={selectFromContacts}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface hover:bg-surface-soft border border-theme rounded-lg text-xs font-bold text-theme-main transition-all"
                            >
                                <Users size={14} className="text-primary" />
                                <span>Select from Contacts App</span>
                                {!('contacts' in navigator) && <span className="text-[10px] opacity-40 font-normal ml-1">(Mobile only)</span>}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <p className="text-textMuted text-xs font-medium">
                                {guardian ? `Guardian: ${guardian}` : 'Set a contact to notify during emergencies.'}
                            </p>
                            {guardian && <div className="w-2 h-2 rounded-full bg-safe shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                        </div>
                    )}
                </div>

                {/* Direct Call Guardian */}
                {guardian && (
                    <a href={`tel:${guardian}`} className="flex items-center p-4 bg-surface-soft rounded-2xl border border-safe/30 shadow-md shadow-safe/5 transform active:scale-95 transition-all">
                        <div className="w-12 h-12 rounded-full bg-safe/20 flex items-center justify-center mr-4"><PhoneCall className="text-safe" size={24} /></div>
                        <div className="text-left flex-1">
                            <h3 className="text-textMain font-bold">Call Guardian</h3>
                            <p className="text-textMuted text-xs">Direct dial {guardian}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-safe/10 flex items-center justify-center">
                            <Navigation className="text-safe" size={14} />
                        </div>
                    </a>
                )}

                <a href="tel:112" className="flex items-center p-4 bg-surface-soft rounded-2xl border border-theme shadow-md transform active:scale-95 transition-all">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mr-4"><PhoneCall className="text-primary" size={24} /></div>
                    <div className="text-left flex-1">
                        <h3 className="text-textMain font-bold">Call Police (112)</h3>
                        <p className="text-textMuted text-xs">Direct dial national emergency</p>
                    </div>
                </a>

                <button onClick={performFakeCall} className="w-full flex items-center p-4 bg-surface-soft rounded-2xl border border-theme shadow-md active:scale-95 transition-all text-left">
                    <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center mr-4"><BellRing className="text-warning" size={24} /></div>
                    <div className="text-left flex-1">
                        <h3 className="text-textMain font-bold">Schedule Fake Call</h3>
                        <p className="text-textMuted text-xs">Simulated incoming call in 3s</p>
                    </div>
                </button>
            </div>

            {/* STATUS OVERLAYS (Reactive) */}
            {status !== 'idle' && (
                <div className="fixed inset-0 bg-background/95 backdrop-blur-2xl z-[200] flex flex-col items-center justify-center p-8 transition-all">
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 relative ${
                        status === 'broadcasting' ? 'bg-primary/20' : 
                        status === 'success' ? 'bg-safe/20' : 'bg-danger/20'
                    }`}>
                        {status === 'broadcasting' && (
                            <div className="absolute inset-0 border-[6px] border-primary border-t-transparent rounded-full animate-spin" />
                        )}
                        {status === 'broadcasting' && <Navigation className="text-primary animate-pulse" size={48} />}
                        {status === 'success' && <Shield className="text-safe" size={48} fill="currentColor" />}
                        {status === 'error' && <AlertCircle className="text-danger" size={48} />}
                    </div>
                    
                    <h2 className={`text-3xl font-black mb-3 tracking-tighter ${
                        status === 'broadcasting' ? 'text-primary' : 
                        status === 'success' ? 'text-safe' : 'text-danger'
                    }`}>
                        {status === 'broadcasting' && 'BROADCASTING...'}
                        {status === 'success' && 'SOS LOGGED'}
                        {status === 'error' && 'FAILED'}
                    </h2>
                    
                    <p className="text-theme-muted text-center text-sm max-w-xs leading-relaxed font-medium">
                        {status === 'broadcasting' && 'Transmitting live GPS coordinates to central safety grid and nearby responders.'}
                        {status === 'success' && 'Emergency registered successfully. Live location has been automatically sent to your guardian via Telegram.'}
                        {status === 'error' && 'GPS or network error. Please ensure location permissions are enabled and try again.'}
                    </p>

                    {status !== 'broadcasting' && (
                        <button onClick={() => setStatus('idle')} className="mt-8 text-theme-muted font-bold border-b border-theme pb-1 text-xs tracking-widest uppercase">
                            Dismiss
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
