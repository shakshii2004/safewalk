import { addDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { reportsCollection, emergenciesCollection, auth } from './firebase';

export const submitReport = async (type, location, description = "") => {
    try {
        const userId = auth.currentUser?.uid || 'anonymous';
        await addDoc(reportsCollection, {
            type, lat: location.lat, lng: location.lng, description, 
            timestamp: serverTimestamp(),
            userId
        });
        return true;
    } catch (e) {
        console.error("Error submitting real report", e);
        return false;
    }
};

export const triggerSOS = async (location, riskScore = 0, alertStatus = "manual", userResponse = "pending") => {
    try {
        const userId = auth.currentUser?.uid || 'anonymous';
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firebase timeout')), 5000)
        );
        
        const addDocPromise = addDoc(emergenciesCollection, {
            lat: location ? location.lat : null, 
            lng: location ? location.lng : null, 
            timestamp: serverTimestamp(), 
            status: "active",
            riskScore,
            alertStatus,
            userResponse,
            userId
        });

        await Promise.race([addDocPromise, timeoutPromise]);
        return true;
    } catch (e) {
        console.error("Error triggering real SOS", e);
        return false;
    }
};

export const sendTelegramAudio = async (audioBlob) => {
    const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId || !audioBlob) return false;

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('audio', audioBlob, 'evidence.webm');
    formData.append('title', 'Emergency Audio Evidence');

    try {
        const url = `https://api.telegram.org/bot${botToken}/sendAudio`;
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        return data.ok === true;
    } catch (e) {
        console.error("Failed to send Telegram audio", e);
        return false;
    }
};

export const triggerTelegramAlert = async (location, riskScore = 0, customMessage = "") => {
    const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId) {
        console.warn("Telegram bot token or chat ID is missing.");
        return false;
    }

    const message = customMessage || `🚨 EMERGENCY ALERT 🚨\nI may be in danger.\n\nRisk Score: ${riskScore}/100\nLocation: https://maps.google.com/?q=${location?.lat},${location?.lng}\nTime: ${new Date().toLocaleString()}\n\nPlease contact me immediately!`;

    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
            }),
        });
        
        const data = await response.json();
        if (!data.ok) {
            console.error("Telegram API rejected the request:", data);
        }
        return data.ok === true;
    } catch (e) {
        console.error("Failed to send Telegram alert", e);
        return false;
    }
};

export const listenToNearbyReports = (location, radiusInKm = 5, callback) => {
    if (!location) { callback([]); return () => { }; }
    const timeLimit = new Date();
    timeLimit.setHours(timeLimit.getHours() - 12);
    const q = query(reportsCollection, where('timestamp', '>=', timeLimit));

    return onSnapshot(q, (snapshot) => {
        let nearbyReports = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.lat && data.lng) {
                const distance = Math.sqrt(Math.pow(data.lat - location.lat, 2) + Math.pow(data.lng - location.lng, 2));
                if (distance < (radiusInKm * 0.01)) { nearbyReports.push({ id: doc.id, ...data }); }
            }
        });
        callback(nearbyReports);
    }, (error) => {
        console.warn("Could not listen to real reports. Ensure Firebase config is valid.", error);
        callback([]);
    });
};
