export const RatibuLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 400 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Stylized R (Backwards as per logo) */}
    <path d="M70 30H30V90H45V65H70L85 90H100L85 65C95 60 100 50 100 40C100 30 90 30 70 30ZM45 45H70C75 45 85 45 85 55C85 65 75 65 70 65H45V45Z" fill="currentColor"/>
    
    {/* Lightning Bolt Bolt (Insignia style) */}
    <path d="M125 20L100 70H120L110 110L140 50H120L130 20H125Z" fill="#B91C1C" className="text-secondary dark:text-accent"/>
    
    {/* ATIBU Text in Blue/Green based on theme? converting explicit colors to currentColor or keeping brand colors */}
    {/* Original had fill="#3B82F6" (Blue). Assuming we want to keep brand colors or allow overrides. 
        If we want it 'same as header', header had specific colors. 
        Adjusting to use current text color or specific brand classes for flexibility. 
    */}
    <path d="M170 30L145 90H160L165 78H185L190 90H205L180 30H170ZM168 68L175 48L182 68H168Z" fill="#3B82F6"/>
    <path d="M220 42H205V30H250V42H235V90H220V42Z" fill="#3B82F6"/>
    <path d="M260 30H275V90H260V30Z" fill="#3B82F6"/>
    <path d="M285 30H315C330 30 340 40 340 55C340 70 330 80 315 80H300V90H285V30ZM300 42V68H315C322 68 325 65 325 55C325 45 322 42 315 42H300Z" fill="#3B82F6"/>
    <path d="M350 30V75C350 85 360 90 375 90C390 90 400 85 400 75V30H385V75C385 78 382 80 375 80C368 80 365 78 365 75V30H350Z" fill="#3B82F6"/>
    
    {/* "WE COORDINATE" Tagline */}
    <text x="180" y="110" className="text-[14px] font-black tracking-[0.3em]" fill="currentColor">WE COORDINATE</text>
  </svg>
);
