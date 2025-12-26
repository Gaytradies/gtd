import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  textarea?: boolean;
}

export const Input: React.FC<InputProps> = ({ label, textarea, ...props }) => (
  <div className="mb-4 group">
    {label && <label className="block text-sm font-bold text-slate-300 mb-2.5 transition-all duration-200 group-focus-within:text-orange-400">{label}</label>}
    {textarea ? (
      <textarea className="w-full p-4 border-2 border-slate-600 rounded-2xl focus:ring-4 focus:ring-orange-500/30 focus:border-orange-500 focus:outline-none text-black transition-all duration-300 shadow-lg hover:border-orange-500/50 hover:shadow-xl focus:shadow-2xl bg-white backdrop-blur-sm placeholder:text-slate-400 min-h-[48px]" {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} />
    ) : (
      <input className="w-full p-4 border-2 border-slate-600 rounded-2xl focus:ring-4 focus:ring-orange-500/30 focus:border-orange-500 focus:outline-none text-black transition-all duration-300 shadow-lg hover:border-orange-500/50 hover:shadow-xl focus:shadow-2xl bg-white backdrop-blur-sm placeholder:text-slate-400 min-h-[48px]" {...props as React.InputHTMLAttributes<HTMLInputElement>} />
    )}
  </div>
);
