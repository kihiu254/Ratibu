export const RatibuLogo = ({ className = "h-12 w-auto" }: { className?: string }) => (
  <img 
    src="/logo-chama-v2.png" 
    alt="Ratibu Logo" 
    className={`${className} object-contain dark:hidden`} 
  />
);

export const RatibuLogoDark = ({ className = "h-12 w-auto" }: { className?: string }) => (
  <img 
    src="/logo-chama-dark-v2.png" 
    alt="Ratibu Logo" 
    className={`${className} object-contain hidden dark:block`} 
  />
);

export const RatibuLogoAuth = ({ className = "h-12 w-auto" }: { className?: string }) => (
  <img 
    src="/logo-auth-v2.png" 
    alt="Ratibu Auth Logo" 
    className={`${className} object-contain`} 
  />
);
