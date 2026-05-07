import React, { useState, useEffect } from 'react';
import { AlertCircle, Mic, ShieldOff } from 'lucide-react';
import useGeolocation from '../hooks/useGeolocation';
import usePlacesData from '../hooks/usePlacesData';
import { calculateRiskScore } from '../utils/riskEngine';
import RiskMeter from '../components/RiskMeter';
import { listenToNearbyReports, triggerSOS, triggerTelegramAlert, sendTelegramAudio } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';

export default function Home() {
    const { location, error } = useGeolocation();

    // Real-Time Context Hooks (Google Places API & Firebase)
    const placesData = usePlacesData(location);
    const [realReportCount, setRealReportCount] = useState(0);

    const [riskData, setRiskData] = useState({ score: 0, level: 'LOW', reasons: ["Acquiring GPS..."] });
    const [walkMode, setWalkMode] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const [riskAlert, setRiskAlert] = useState(null); // { level: 'MEDIUM' | 'HIGH', message: string }

    // 1. Subscribe to backend reports
    useEffect(() => {
        if (!location) return;
        const unsubscribe = listenToNearbyReports(location, 5, (reports) => {
            setRealReportCount(reports.length);
        });
        return () => unsubscribe();
    }, [location]);

    // 2. Core Risk Engine Processing Loop
    useEffect(() => {
        const updateRisk = () => {
            setRiskData(prev => {
                const newData = calculateRiskScore(location, new Date(), realReportCount, placesData, prev.score);
                
                // Trigger Vibration and Alert on Risk Increase
                if (walkMode && newData.level !== prev.level) {
                    if (newData.level === 'MEDIUM') {
                        navigator.vibrate?.([200, 100, 200]);
                        setRiskAlert({ level: 'MEDIUM', message: 'Entering Cautious Area' });
                        setTimeout(() => setRiskAlert(null), 5000);
                    } else if (newData.level === 'HIGH') {
                        navigator.vibrate?.([500, 100, 500, 100, 500]);
                        setRiskAlert({ level: 'HIGH', message: 'Entering High Risk Area!' });
                        setTimeout(() => setRiskAlert(null), 5000);
                    }
                }
                
                return newData;
            });
        };

        const interval = setInterval(updateRisk, 5000);
        updateRisk();

        return () => clearInterval(interval);
    }, [location, realReportCount, placesData, walkMode]);

    // 3. Smart Predictive Safety Flow
    const [countdown, setCountdown] = useState(null);
    const [lastTriggeredRisk, setLastTriggeredRisk] = useState(0);
    const [lastMovedLocation, setLastMovedLocation] = useState(null);
    const [lastMovedTime, setLastMovedTime] = useState(Date.now());
    const [batteryAlertSent, setBatteryAlertSent] = useState(false);
    const [arrivalTimer, setArrivalTimer] = useState(null); // time in minutes
    const [expiryTime, setExpiryTime] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [voiceSentry, setVoiceSentry] = useState(true);
    const [homeLocation, setHomeLocation] = useState(null);
    const [stealthMode, setStealthMode] = useState(false);
    const { user, logout } = useAuth();
    const [userSettings, setUserSettings] = useState(null);

    // Fetch User Settings from Firestore
    useEffect(() => {
        if (!user) return;
        const fetchSettings = async () => {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserSettings(data);
                if (data.guardianPhone) localStorage.setItem('sw-guardian', data.guardianPhone);
                if (data.homeCoords) {
                    setHomeLocation(data.homeCoords);
                    localStorage.setItem('sw-home-location', JSON.stringify(data.homeCoords));
                }
                setVoiceSentry(data.enableVoice ?? true);
            }
        };
        fetchSettings();
    }, [user]);

    // Battery & Movement Monitoring (Always active on Dashboard)
    useEffect(() => {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                const checkBattery = () => {
                    if (battery.level <= 0.08 && !battery.charging) {
                        executeAutomaticSOS("🚨 CRITICAL BATTERY SOS 🚨\nMy phone is dying (<= 8%)!\nLocation: https://maps.google.com/?q=" + location?.lat + "," + location?.lng);
                    }
                };
                battery.addEventListener('levelchange', checkBattery);
                checkBattery();
            });
        }
    }, [location]);

    // Watch for High Risk and Movement Anomalies
    useEffect(() => {
        if (!location || !walkMode || countdown !== null) return;

        const now = Date.now();
        
        // A. Direct Risk Threshold Detection
        if (riskData.score > 60 && (now - lastTriggeredRisk > 60000)) {
            setShowPrompt(true);
            setCountdown(10);
            setLastTriggeredRisk(now);
            return;
        }

        // B. Movement Anomaly Detection (Inactivity)
        if (!lastMovedLocation) {
            setLastMovedLocation(location);
            setLastMovedTime(now);
            return;
        }

        const distanceMoved = Math.sqrt(
            Math.pow(location.lat - lastMovedLocation.lat, 2) + 
            Math.pow(location.lng - lastMovedLocation.lng, 2)
        );

        // Distance threshold roughly 10 meters (approx 0.0001 degrees)
        if (distanceMoved > 0.0001) {
            setLastMovedLocation(location);
            setLastMovedTime(now);
        } else {
            const idleTime = now - lastMovedTime;
            // If idle for more than 2 minutes in a non-low risk area
            if (idleTime > 120000 && riskData.score > 30 && (now - lastTriggeredRisk > 60000)) {
                setShowPrompt(true);
                setCountdown(10);
                setLastTriggeredRisk(now);
                setLastMovedTime(now); // Reset timer to prevent rapid firing
            }
        }
    }, [riskData.score, walkMode, countdown, location, lastMovedLocation, lastMovedTime, lastTriggeredRisk]);

    // Countdown logic
    useEffect(() => {
        let timer;
        if (showPrompt && countdown !== null && countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        } else if (showPrompt && countdown === 0) {
            // User did not respond in 10 seconds! Trigger Automatic SOS!
            setShowPrompt(false);
            setCountdown(null);
            executeAutomaticSOS();
        }
        return () => clearTimeout(timer);
    }, [showPrompt, countdown]);

    // Watch for Battery Levels
    useEffect(() => {
        if (!walkMode || batteryAlertSent || !location) return;

        const checkBattery = async () => {
            if ('getBattery' in navigator) {
                const battery = await navigator.getBattery();
                
                // Critical Battery (Below 8%) - IMMEDIATE SOS
                if (battery.level <= 0.08) {
                    setBatteryAlertSent(true);
                    executeAutomaticSOS(`🚨 CRITICAL BATTERY SOS 🚨\nMy battery is almost dead (${Math.round(battery.level * 100)}%).\nMy last known location: https://maps.google.com/?q=${location.lat},${location.lng}`);
                }
                // Low Battery (Below 10%) - Warning Only
                else if (battery.level <= 0.10) {
                    setBatteryAlertSent(true);
                    triggerTelegramAlert(location, riskData.score, `⚠️ LOW BATTERY WARNING ⚠️\nMy battery is at ${Math.round(battery.level * 100)}%.\nMy last known location: https://maps.google.com/?q=${location.lat},${location.lng}`);
                }
            }
        };

        const interval = setInterval(checkBattery, 60000); // Check every minute
        checkBattery();
        return () => clearInterval(interval);
    }, [walkMode, batteryAlertSent, location, riskData.score]);

    // Watch for Smart Arrival Timer
    useEffect(() => {
        if (!walkMode || !expiryTime || countdown !== null) return;

        const checkExpiry = () => {
            if (Date.now() > expiryTime) {
                setShowPrompt(true);
                setCountdown(10);
                setExpiryTime(null); // Clear timer after triggering
                setArrivalTimer(null);
            }
        };

        const interval = setInterval(checkExpiry, 10000);
        checkExpiry();
        return () => clearInterval(interval);
    }, [walkMode, expiryTime, countdown]);

    // Watch for Voice Panic Words (Global or WalkMode)
    useEffect(() => {
        if (!walkMode && !voiceSentry) {
            setIsListening(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
            if (walkMode || voiceSentry) recognition.start();
            else setIsListening(false);
        };

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript.toLowerCase())
                .join('');

            const panicWords = ['help', 'emergency', 'sos', 'stop it', 'save me', 'police'];
            if (panicWords.some(word => transcript.includes(word))) {
                executeAutomaticSOS("🚨 VOICE ACTIVATED SOS 🚨\nI shouted 'HELP'!\nMy location: https://maps.google.com/?q=" + location?.lat + "," + location?.lng);
                recognition.stop();
            }
        };

        recognition.start();
        return () => recognition.stop();
    }, [walkMode, voiceSentry, location]);

    // Watch for Sunset Risk & Auto-Home Geofencing
    useEffect(() => {
        if (!location || walkMode) return;

        const now = new Date();
        const hour = now.getHours();
        const isNight = hour >= 20 || hour <= 5; // 8 PM to 5 AM

        // Auto-Geofence: If at night and moving away from home
        const homeStr = localStorage.getItem('sw-home-location');
        if (isNight && homeStr) {
            const home = JSON.parse(homeStr);
            const distFromHome = Math.sqrt(
                Math.pow(location.lat - home.lat, 2) + 
                Math.pow(location.lng - home.lng, 2)
            );

            // If more than 200m from home at night without monitoring
            if (distFromHome > 0.002 && !walkMode && (Date.now() - lastTriggeredRisk > 300000)) {
                setRiskAlert({ level: 'MEDIUM', message: 'Away from Home - Auto Monitoring Suggested' });
                setTimeout(() => setRiskAlert(null), 5000);
                setLastTriggeredRisk(Date.now());
            }
        }
    }, [location, walkMode, lastTriggeredRisk]);

    const handleWalkModeToggle = () => {
        if (!walkMode) {
            // Turning ON
            setWalkMode(true);
            setBatteryAlertSent(false);
            setLastMovedTime(Date.now());
            if (arrivalTimer) {
                setExpiryTime(Date.now() + (arrivalTimer * 60 * 1000));
            }
        } else {
            // Turning OFF
            setWalkMode(false);
            setExpiryTime(null);
        }
    };

    const captureAudioEvidence = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await sendTelegramAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            // Record for 10 seconds
            setTimeout(() => {
                if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            }, 10000);
        } catch (err) {
            console.error("Audio capture failed:", err);
        }
    };

    const executeAutomaticSOS = async (customMessage = null) => {
        // Start capturing audio evidence immediately
        captureAudioEvidence();

        // 1. Log to Firebase Firestore
        await triggerSOS(location, riskData.score, "auto-triggered", "no-response");
        
        // 2. Try Telegram (Primary — sends location automatically)
        const guardian = localStorage.getItem('sw-guardian');
        let telegramSuccess = await triggerTelegramAlert(location, riskData.score, customMessage);
 
        // 3. SMS fallback ONLY if Telegram failed
        if (!telegramSuccess && guardian) {
            const smsMessage = customMessage || `🚨 AUTOMATIC EMERGENCY ALERT 🚨\nI may be in danger. (Risk Score: ${riskData.score}/100)\nMy current location:\nhttps://maps.google.com/?q=${location?.lat},${location?.lng}\nPlease contact me immediately.`;
            window.location.href = `sms:${guardian}?body=${encodeURIComponent(smsMessage)}`;
        }
    };

    const confirmSafety = () => {
        setShowPrompt(false);
        setCountdown(null);
        triggerSOS(location, riskData.score, "auto-triggered", "marked-safe");
    };

    const getStatusLabel = () => {
        if (countdown !== null) return { text: "EMERGENCY TRIGGERED", color: "text-danger", bg: "bg-danger", ping: true };
        if (riskData.score > 60) return { text: "HIGH RISK DETECTED", color: "text-warning", bg: "bg-warning", ping: true };
        if (walkMode) return { text: "MONITORING ACTIVE", color: "text-primary", bg: "bg-primary", ping: true };
        return { text: "SYSTEM SAFE", color: "text-safe", bg: "bg-safe", ping: false };
    };
    
    const currentStatus = getStatusLabel();

    if (stealthMode) {
        return (
            <div className="p-6 h-full bg-slate-50 overflow-y-auto text-slate-900 font-serif">
                <div className="flex justify-between items-center mb-8 border-b pb-4 border-slate-200 pr-14">
                    <h1 className="text-2xl font-black italic">Daily Chronicle</h1>
                    <button onClick={() => setStealthMode(false)} className="text-xs text-slate-500 font-medium whitespace-nowrap">Update Feed</button>
                </div>
                
                <div className="space-y-8">
                    {[
                        { title: "Market Trends Show Resilience", desc: "Global indices remained steady today as investors await the latest economic data release." },
                        { title: "New Green Spaces for Cities", desc: "Urban planners are focusing on more parklands to improve the mental well-being of residents." },
                        { title: "Breakthrough in Fusion Energy", desc: "Scientists report a major milestone in clean energy generation at the National Ignition Facility." }
                    ].map((news, i) => (
                        <div key={i} onClick={(e) => {
                            if (e.detail === 3) {
                                executeAutomaticSOS("🚨 SILENT STEALTH SOS 🚨\nI triggered SOS from Stealth Mode.\nMy location: https://maps.google.com/?q=" + location?.lat + "," + location?.lng);
                                navigator.vibrate?.([50, 50, 50]);
                            }
                        }} className="active:bg-slate-100 transition-colors">
                            <h2 className="text-xl font-bold mb-2 leading-tight">{news.title}</h2>
                            <p className="text-slate-600 text-sm leading-relaxed">{news.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="fixed bottom-20 left-0 right-0 p-4 text-center">
                    <p className="text-[10px] text-slate-300">© 2026 Global News Syndicate • Privacy Policy</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full overflow-y-auto flex flex-col items-center space-y-6 relative bg-theme text-theme-main">
            {riskAlert && (
                <div className={`fixed top-4 left-4 right-4 z-[150] p-4 rounded-2xl border shadow-2xl animate-in slide-in-from-top duration-500 flex items-center gap-3 ${
                    riskAlert.level === 'HIGH' ? 'bg-danger border-rose-400 text-white' : 'bg-warning border-amber-400 text-slate-900'
                }`}>
                    <AlertCircle className={riskAlert.level === 'HIGH' ? 'text-white' : 'text-slate-900'} size={24} />
                    <div className="flex-1">
                        <p className="font-black uppercase text-xs tracking-widest">{riskAlert.message}</p>
                        <p className="text-[10px] font-bold opacity-80">Guardian AI is monitoring closely.</p>
                    </div>
                </div>
            )}
            <div className="w-full flex items-center justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <UserIcon size={14} className="text-primary" />
                        <span className="text-[10px] text-theme-muted font-black uppercase tracking-widest">Authorized User</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-textMain tracking-tight">SafeWalk</h1>
                    <p className="text-textMuted text-xs mt-1 font-medium tracking-wide">Welcome back, {user?.email?.split('@')[0]}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={logout}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-surface border border-theme text-theme-muted hover:text-danger hover:border-danger transition-all"
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                    <button 
                        onClick={() => setStealthMode(!stealthMode)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${stealthMode ? 'bg-primary border-primary text-white' : 'bg-surface border-theme text-theme-muted'}`}
                        title="Stealth Mode"
                    >
                        <ShieldOff size={18} />
                    </button>
                    <button 
                        onClick={() => setVoiceSentry(!voiceSentry)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${voiceSentry ? 'bg-primary/20 border-primary text-primary animate-pulse' : 'bg-surface border-theme text-theme-muted'}`}
                        title="Voice Sentry Mode"
                    >
                        <Mic size={18} />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center border border-theme">
                        <span className={`w-2 h-2 rounded-full ${currentStatus.bg} ${currentStatus.ping ? 'animate-pulse' : ''}`}></span>
                    </div>
                </div>
            </div>

            <div className={`w-full p-6 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center border mt-4 relative overflow-hidden transition-all duration-700 ${riskData.score > 60 ? 'bg-danger/10 border-danger/50 animate-pulse-ring' : walkMode ? 'bg-primary/15 border-primary/40 animate-pulse-ring' : 'bg-card-theme border-theme'}`}>
                <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none ${riskData.score > 60 ? 'bg-danger/20' : walkMode ? 'bg-primary/10' : 'bg-primary/5'}`} />
                <RiskMeter score={riskData.score} level={riskData.level} />
            </div>

            {error ? (
                <div className="text-danger text-sm bg-danger/10 p-3 rounded-xl w-full border border-danger/30 text-center font-medium">
                    {error} (Please allow location access for accurate risk prediction)
                </div>
            ) : (
                <div className={`${currentStatus.color} text-[10px] uppercase font-bold tracking-widest flex flex-col items-start w-full transition-colors`}>
                    <span className="flex items-center">
                        <span className={`w-2 h-2 rounded-full ${currentStatus.bg} ${currentStatus.ping ? 'animate-ping' : ''} mr-2`}></span> 
                        {currentStatus.text}
                    </span>
                    {placesData.isSearching && <span className="text-textMuted mt-1">Scanning Environment...</span>}
                    {isListening && (
                        <span className="text-primary mt-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                            Voice Guardian Active
                        </span>
                    )}
                </div>
            )}

            <div className="w-full mt-auto mb-4 relative z-10 space-y-4">
                {!walkMode && (
                    <div className="flex flex-col items-center gap-2 mb-2">
                        <p className="text-textMuted text-[10px] uppercase font-bold tracking-widest">Set Arrival Timer (Optional)</p>
                        <div className="flex gap-2 w-full justify-center">
                            {[10, 20, 30, 60].map(min => (
                                <button
                                    key={min}
                                    onClick={() => setArrivalTimer(arrivalTimer === min ? null : min)}
                                    className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${arrivalTimer === min ? 'bg-primary border-primary text-white shadow-lg' : 'bg-surface border-theme text-theme-muted'}`}
                                >
                                    {min}m
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <button
                    onClick={handleWalkModeToggle}
                    className={`w-full ${walkMode ? 'bg-emerald-100 border border-emerald-300 text-emerald-700 hover:bg-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-[0_0_20px_rgba(99,102,241,0.35)]'} text-white font-bold py-4 rounded-2xl active:scale-95 transition-all text-sm uppercase tracking-wide`}
                >
                    {walkMode ? (expiryTime ? `🛑 Monitoring (${Math.round((expiryTime - Date.now()) / 60000)}m left)` : '🛑 Disable Monitoring') : '🛡️ Walk With Me'}
                </button>
            </div>

            {showPrompt && (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6">
                    <div className="bg-card-theme rounded-[2rem] p-8 border border-danger w-full text-center shadow-[0_0_50px_rgba(244,63,94,0.5)] animate-pulse-ring">
                        <div className="w-24 h-24 rounded-full bg-danger/20 flex items-center justify-center mx-auto mb-4">
                            <span className="text-danger text-5xl font-black">{countdown}</span>
                        </div>
                        <h2 className="text-3xl font-black text-danger tracking-tight mb-2">Are you safe?</h2>
                        <p className="text-textMuted mb-8 text-sm font-medium">
                            {riskData.score > 60 ? 'High risk environmental factors detected.' : (Date.now() > expiryTime ? 'Arrival timer expired.' : 'Unusual inactivity detected in a risky area.')}
                            <br/>Automatic SOS triggers in {countdown}s.
                        </p>
                        <button
                            onClick={confirmSafety}
                            className="w-full bg-safe hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold text-lg active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                        >
                            Yes, I'm safe
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
