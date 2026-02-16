export const RatibuInsignia = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 140 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Stylized R (Backwards as per logo) */}
    <path d="M70 30H30V90H45V65H70L85 90H100L85 65C95 60 100 50 100 40C100 30 90 30 70 30ZM45 45H70C75 45 85 45 85 55C85 65 75 65 70 65H45V45Z" fill="currentColor"/>
    
    {/* Lightning Bolt Bolt (Insignia style) */}
    <path d="M125 20L100 70H120L110 110L140 50H120L130 20H125Z" fill="#B91C1C" />
  </svg>
);
