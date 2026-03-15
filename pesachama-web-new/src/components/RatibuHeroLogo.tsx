import React from 'react';

interface RatibuHeroLogoProps {
  className?: string;
  dark?: boolean;
  auth?: boolean;
}

export const RatibuHeroLogo: React.FC<RatibuHeroLogoProps> = ({ className = '', auth = false }) => {
  if (auth) {
    return (
      <img 
        src="/logo-auth-v2.png" 
        alt="Ratibu Auth Logo" 
        className={`object-contain ${className}`}
      />
    );
  }
  return (
    <>
      <img 
        src="/logo-chama-v2.png" 
        alt="Ratibu Chama Logo" 
        className={`object-contain dark:hidden ${className}`}
      />
      <img 
        src="/logo-chama-dark-v2.png" 
        alt="Ratibu Chama Logo" 
        className={`object-contain hidden dark:block ${className}`}
      />
    </>
  );
};
