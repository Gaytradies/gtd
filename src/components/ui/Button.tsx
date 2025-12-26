import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'disabled';
  className?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false, 
  ...props 
}) => {
  const baseStyle = "px-5 py-3.5 rounded-2xl font-bold transition-all duration-300 active:scale-95 flex items-center justify-center gap-2.5 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 backdrop-blur-sm relative overflow-hidden group min-h-[48px] touch-manipulation";
  const variants = {
    primary: "bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white hover:from-slate-700 hover:via-slate-600 hover:to-slate-700 shadow-slate-900/60 hover:shadow-slate-900/80 border border-slate-600 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
    secondary: "bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 text-white hover:from-orange-600 hover:via-orange-700 hover:to-orange-600 shadow-orange-500/60 hover:shadow-orange-600/80 border border-orange-700 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
    outline: "border-2 border-slate-600 text-slate-200 hover:bg-gradient-to-r hover:from-slate-800 hover:to-slate-700 hover:border-orange-500 shadow-slate-900/40 hover:shadow-orange-500/50 backdrop-blur-md hover:text-white",
    ghost: "text-slate-300 hover:bg-gradient-to-r hover:from-slate-800 hover:to-slate-700 shadow-none hover:shadow-lg hover:text-slate-100",
    danger: "bg-gradient-to-r from-red-600 via-red-700 to-red-600 text-white hover:from-red-700 hover:via-red-800 hover:to-red-700 shadow-red-600/60 hover:shadow-red-700/80 border border-red-800 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
    success: "bg-gradient-to-r from-green-600 via-green-700 to-green-600 text-white hover:from-green-700 hover:via-green-800 hover:to-green-700 shadow-green-600/60 hover:shadow-green-700/80 border border-green-800 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
    disabled: "bg-gradient-to-r from-slate-700 to-slate-600 text-slate-500 cursor-not-allowed shadow-none hover:translate-y-0 hover:shadow-none border border-slate-700"
  };
  const variantStyle = disabled ? variants.disabled : variants[variant];
  return (
    <button 
      className={`${baseStyle} ${variantStyle} ${className}`} 
      onClick={disabled ? undefined : onClick} 
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
