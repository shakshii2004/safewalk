import React, { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, CheckCircle2 } from 'lucide-react';
import useGeolocation from '../hooks/useGeolocation';
import { submitReport, listenToNearbyReports } from '../services/api';

export default function Reports() {
    const { location } = useGeolocation();
    const [reportType, setReportType] = useState('dark');
    const [description, setDescription] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [recentReports, setRecentReports] = useState([]);

    useEffect(() => {
        if (!location) return;
        const unsubscribe = listenToNearbyReports(location, 10, (data) => {
            setRecentReports(data.sort((a, b) => b.timestamp - a.timestamp));
        });
        return () => unsubscribe();
    }, [location]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!location) return;
        setIsSubmitting(true);
        const success = await submitReport(reportType, location, description);
        if (success) {
            setSubmitted(true);
            setDescription('');
            setTimeout(() => setSubmitted(false), 3000);
        }
        setIsSubmitting(false);
    };

    const types = [
        { id: 'dark', label: 'Dark Area', color: 'from-slate-600 to-slate-800' },
        { id: 'suspicious', label: 'Suspicious Activity', color: 'from-warning to-yellow-600' },
        { id: 'harassment', label: 'Harassment', color: 'from-danger to-red-600' },
        { id: 'closed', label: 'Road Blocked', color: 'from-primary to-blue-600' },
    ];

    return (
        <div className="p-6 h-full overflow-y-auto flex flex-col items-center bg-theme text-theme-main">
            <div className="w-full mb-6 mt-4">
                <h1 className="text-3xl font-extrabold text-textMain tracking-tight">Community</h1>
                <p className="text-textMuted text-xs mt-1 font-medium">Contribute to the predictive engine.</p>
            </div>
            <div className="w-full flex-1">
                <form onSubmit={handleSubmit} className="bg-card-theme p-5 rounded-[2rem] shadow-xl border border-theme flex flex-col space-y-6">
                    <div>
                        <label className="text-xs font-bold text-textMuted uppercase tracking-widest mb-3 block">Condition Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            {types.map(t => (
                                <div key={t.id} onClick={() => setReportType(t.id)} className={`p-3 rounded-xl border-2 flex items-center justify-center flex-col text-center transition-all cursor-pointer ${reportType === t.id ? `border-primary bg-gradient-to-br ${t.color}` : 'border-theme bg-surface'}`}>
                                    <span className={`text-xs font-bold ${reportType === t.id ? 'text-white' : 'text-textMain'}`}>{t.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-textMuted uppercase tracking-widest mb-2 flex items-center"><MapPin size={14} className="mr-1" /> Location</label>
                        <div className="w-full bg-surface rounded-xl p-3 border border-theme text-sm text-textMuted flex items-center justify-between">
                            <span>Current GPS Array</span>
                            {location ? <span className="text-safe text-[10px] bg-safe/10 px-2 py-1 rounded">LOCKED</span> : <span className="text-warning text-[10px] bg-warning/10 px-2 py-1 rounded">WAITING...</span>}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-textMuted uppercase tracking-widest mb-2 block">Description (Optional)</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-surface rounded-xl p-3 border border-theme text-sm text-textMain outline-none resize-none placeholder:text-theme-muted focus:border-primary transition-colors" rows="2" placeholder="Provide details..."></textarea>
                    </div>
                    <button type="submit" disabled={!location || isSubmitting} className="w-full bg-primary hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-95 transition-all text-sm uppercase tracking-wide flex items-center justify-center mt-2">
                        {submitted ? <CheckCircle2 className="mr-2" size={20} /> : <AlertTriangle className="mr-2 text-white" size={20} />}
                        {submitted ? 'Report Cloud Logged' : 'Submit Globally'}
                    </button>
                </form>
                <div className="mt-8 px-2">
                    <h3 className="text-xs font-bold text-textMuted uppercase tracking-widest mb-4">Live Nearby Feed</h3>
                    <div className="space-y-3">
                        {recentReports.length > 0 ? recentReports.map((report, idx) => (
                            <div key={idx} className="bg-card-theme p-4 rounded-2xl border border-theme flex items-start">
                                <div className={`w-2 h-2 rounded-full mt-1.5 mr-3 ${report.type === 'harassment' ? 'bg-danger' : report.type === 'suspicious' ? 'bg-warning' : 'bg-primary'}`} />
                                <div>
                                    <p className="text-sm text-textMain font-medium">{types.find(t => t.id === report.type)?.label || 'Report'} logged</p>
                                    <p className="text-xs text-textMuted">{report.description || 'No exact description'}</p>
                                </div>
                            </div>
                        )) : (
                            <p className="text-textMuted text-xs text-center">No active reports in radius.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
