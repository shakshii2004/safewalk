import React from 'react';
import { motion } from 'framer-motion';

export default function RiskMeter({ score, level }) {
    let strokeColor = '#10b981';
    if (level === 'Medium') strokeColor = '#f59e0b';
    if (level === 'High') strokeColor = '#ef4444';

    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
        <div className="flex flex-col items-center justify-center space-y-6 w-full relative py-4">
            <div className="relative flex items-center justify-center w-48 h-48">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="96" cy="96" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" className="text-theme-muted opacity-30" />
                    <motion.circle cx="96" cy="96" r={radius} stroke={strokeColor} strokeWidth="14" fill="transparent" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset }} transition={{ duration: 0.8, ease: 'easeOut' }} strokeLinecap="round" className="drop-shadow-[0_0_8px_currentColor]" />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-5xl font-black text-textMain tracking-tighter">{score}</span>
                </div>
            </div>
        </div>
    );
}
