import React from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

interface BadgeProps {
  type: 'verified' | 'trade' | 'locked' | 'distance' | 'pending';
  text: string;
  icon?: React.ComponentType<{ size: number; className?: string }>;
}

export const Badge: React.FC<BadgeProps> = ({ type, text, icon: Icon }) => {
  const styles = {
    verified: "bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 text-white border-blue-500 shadow-blue-600/60 hover:shadow-blue-700/80",
    trade: "bg-gradient-to-r from-orange-600 via-orange-700 to-orange-600 text-white border-orange-500 shadow-orange-600/60 hover:shadow-orange-700/80",
    locked: "bg-gradient-to-r from-slate-600 via-slate-700 to-slate-600 text-white border-slate-500 shadow-slate-600/60 hover:shadow-slate-700/80",
    distance: "bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white border-slate-600 shadow-slate-800/80 hover:shadow-slate-900/90",
    pending: "bg-gradient-to-r from-amber-600 via-amber-700 to-amber-600 text-white border-amber-500 shadow-amber-600/60 hover:shadow-amber-700/80 animate-pulse"
  };
  return (
    <span className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold border-2 flex items-center gap-1.5 w-fit shadow-lg transition-all duration-300 hover:scale-110 backdrop-blur-sm ${styles[type] || styles.trade}`}>
      {Icon && <Icon size={12} className="transition-transform duration-300 group-hover:rotate-12" />}
      {type === 'verified' && !Icon && <ShieldCheck size={12} className="transition-transform duration-300 group-hover:rotate-12" />}
      {type === 'locked' && !Icon && <AlertCircle size={12} className="transition-transform duration-300 group-hover:rotate-12" />}
      {text}
    </span>
  );
};
