import React from 'react';

interface RatibuHeroLogoProps {
  className?: string;
}

export const RatibuHeroLogo: React.FC<RatibuHeroLogoProps> = ({ className = '' }) => {
  return (
    <div className={`flex items-baseline font-display font-black leading-none select-none tracking-tight ${className}`}>
      {/* Backwards R */}
      <span 
        className="text-[#00C853] inline-block" 
        style={{ transform: 'scaleX(-1)' }}
      >
        R
      </span>
      
      {/* Stylized A */}
      <div className="relative flex items-end justify-center text-[#00C853] h-[1em] w-[0.8em] mx-[0.02em]">
        
        {/* Right-half of A Background */}
        <span 
          className="absolute bottom-0 left-0 w-full text-center"
          style={{ clipPath: 'polygon(35% 0%, 100% 0%, 100% 100%, 35% 100%)' }}
        >
          A
        </span>
        
        {/* Lightning Bolt & Circuits */}
        <svg 
          viewBox="0 0 100 140" 
          className="absolute left-[-15%] top-[-8%] h-[116%] w-[130%] z-10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.15))' }}
        >
          {/* Main Bolt */}
          <path d="M 55 10 L 25 75 H 50 L 32 130 L 85 55 H 55 L 70 10 Z" fill="#991B1B" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
          
          {/* Circuit Nodes (White lines and dots) */}
          <g stroke="white" strokeWidth="2.5" fill="white" strokeLinecap="round">
            {/* Connecting to R (Left) */}
            <line x1="33" y1="45" x2="15" y2="40" />
            <circle cx="15" cy="40" r="3" />
            
            <line x1="28" y1="70" x2="10" y2="80" />
            <circle cx="10" cy="80" r="3" />
            
            {/* Connecting to A right side */}
            <line x1="70" y1="35" x2="90" y2="40" />
            <circle cx="90" cy="40" r="3" />
            
            <line x1="50" y1="95" x2="65" y2="105" />
            <circle cx="65" cy="105" r="3" />
          </g>
        </svg>
      </div>
      
      {/* T I B U */}
      <span className="text-[#00C853]">TIBU</span>
    </div>
  );
};
