import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  large?: boolean;
  size?: "default" | "large" | "icon";
  loading?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  large = false,
  size,
  className = "",
  loading = false,
  ...props
}: ButtonProps) {
  const base =
    "rounded-xl font-bold transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden active:scale-95 text-center flex items-center justify-center";

  const effectiveSize = size || (large ? "large" : "default");

  const sizeStyles = {
    default: "px-6 py-2.5 text-sm",
    large: "px-8 py-4 text-base",
    icon: "p-2",
  };

  const variants = {
    primary: "bg-[#00C853] text-white hover:bg-[#00C853]/90 shadow-glow-green",
    secondary:
      "bg-transparent text-white border border-white/20 hover:bg-white/10 backdrop-blur-sm",
    outline: "bg-transparent text-accent border border-accent/20 hover:bg-accent/10 hover:border-accent shadow-glow-orange",
  };

  return (
    <button 
      className={`${base} ${sizeStyles[effectiveSize]} ${variants[variant]} ${className} ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}
      disabled={loading || props.disabled}
      {...props}
    >
      <span className={`relative z-10 flex items-center justify-center gap-2 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        {children}
      </span>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
      )}
    </button>
  );
}
