// --- CUSTOM ANIMATIONS ---
// Inject custom CSS animations
export const injectCustomAnimations = () => {
  if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes bounce-subtle {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
      }
      
      @keyframes pulse-slow {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }
      
      @keyframes slide-up {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      @keyframes slide-in-right {
        from { transform: translateX(20px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes scale-in {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      
      @keyframes shimmer {
        0% { background-position: -1000px 0; }
        100% { background-position: 1000px 0; }
      }
      
      .animate-bounce-subtle {
        animation: bounce-subtle 2s ease-in-out infinite;
      }
      
      .animate-pulse-slow {
        animation: pulse-slow 3s ease-in-out infinite;
      }
      
      .animate-slide-up {
        animation: slide-up 0.4s ease-out;
      }
      
      .animate-slide-in-right {
        animation: slide-in-right 0.4s ease-out;
      }
      
      .animate-fade-in {
        animation: fade-in 0.3s ease-out;
      }
      
      .animate-scale-in {
        animation: scale-in 0.3s ease-out;
      }
      
      .animate-shimmer {
        animation: shimmer 2s linear infinite;
        background: linear-gradient(to right, #f0f0f0 0%, #e0e0e0 20%, #f0f0f0 40%, #f0f0f0 100%);
        background-size: 1000px 100%;
      }
      
      /* Stagger animation for grid items */
      .animate-stagger > * {
        animation: scale-in 0.4s ease-out;
      }
      
      .animate-stagger > *:nth-child(1) { animation-delay: 0.05s; }
      .animate-stagger > *:nth-child(2) { animation-delay: 0.1s; }
      .animate-stagger > *:nth-child(3) { animation-delay: 0.15s; }
      .animate-stagger > *:nth-child(4) { animation-delay: 0.2s; }
      .animate-stagger > *:nth-child(5) { animation-delay: 0.25s; }
      .animate-stagger > *:nth-child(6) { animation-delay: 0.3s; }
      .animate-stagger > *:nth-child(7) { animation-delay: 0.35s; }
      .animate-stagger > *:nth-child(8) { animation-delay: 0.4s; }
      .animate-stagger > *:nth-child(9) { animation-delay: 0.45s; }
    `;
    document.head.appendChild(styleSheet);
  }
};
