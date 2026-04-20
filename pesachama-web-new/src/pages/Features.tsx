import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Globe, RefreshCcw, Bell, LineChart, FileCheck, Users, LockKeyhole } from 'lucide-react';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import Seo from '../components/Seo';

const Features = () => {
    const navigate = useNavigate();

    const featureCategories = [
        {
            category: "Core Banking",
            items: [
                { icon: <Globe />, title: "USSD & App Access", desc: "Transact globally through our app or locally via USSD without internet." },
                { icon: <RefreshCcw />, title: "Automated Collections", desc: "Auto-deduct contributions using mobile money APIs (M-Pesa integration)." },
                { icon: <Zap />, title: "Instant Payouts", desc: "One-click dividend disbursement to all members simultaneously." },
                { icon: <ShieldCheck />, title: "Multi-Sig Approvals", desc: "Require multiple admin approvals before large withdrawals." }
            ]
        },
        {
            category: "Analytics & Reporting",
            items: [
                { icon: <LineChart />, title: "Real-time Dashboards", desc: "Track group net worth, outstanding loans, and cash flow." },
                { icon: <FileCheck />, title: "Automated Ledgers", desc: "Say goodbye to Excel. Every transaction updates the master ledger instantly." },
                { icon: <Bell />, title: "Smart Notifications", desc: "SMS alerts for deposits, upcoming dues, and loan defaults." },
                { icon: <Users />, title: "Member Scoring", desc: "Proprietary credit scoring based on individual saving habits." }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-midnight text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
            <Seo
              title="Ratibu Chama Features"
              description="Explore Ratibu Chama features for USSD banking, digital savings, group contributions, automation, reporting, notifications, KYC, and secure chama management."
              canonicalPath="/features"
              keywords={[
                'Ratibu features',
                'USSD banking features',
                'chama automation',
                'digital savings tools',
                'group contribution management',
                'member scoring',
                'financial reporting',
                'secure chama platform',
              ]}
            />
            <Navbar />
            
            <section className="pt-40 pb-20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#00C853]/10 to-transparent pointer-events-none" />
                
                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight mb-6">
                            Everything you <span className="text-gradient-green">need.</span><br/>
                            Nothing you don't.
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium mb-12">
                            A complete feature set designed from the ground up to handle the complexities of African savings groups and SMEs.
                        </p>
                    </motion.div>
                </div>
            </section>

            <section className="py-20 relative z-10">
                <div className="max-w-7xl mx-auto px-6">
                    {featureCategories.map((category) => (
                        <div key={category.category} className="mb-24 last:mb-0">
                            <div className="flex items-center gap-4 mb-12">
                                <h2 className="text-3xl md:text-4xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">{category.category}</h2>
                                <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {category.items.map((feature, i) => (
                                    <motion.div 
                                        key={feature.title}
                                        initial={{ opacity: 0, y: 30 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true, margin: "-50px" }}
                                        transition={{ delay: i * 0.1 }}
                                        className="bg-white hover:bg-slate-50 dark:bg-slate-900/50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-white/5 rounded-3xl p-8 transition-colors duration-300 group"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:text-[#00C853] group-hover:bg-[#00C853]/10 transition-colors duration-300 mb-6">
                                            {feature.icon}
                                        </div>
                                        <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">{feature.title}</h3>
                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                                            {feature.desc}
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="py-24 bg-[#00C853] relative overflow-hidden">
                 <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
                    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                        <filter id="noiseFilter">
                            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                        </filter>
                        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
                    </svg>
                 </div>
                 <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                     <LockKeyhole className="w-16 h-16 text-white mx-auto mb-6 opacity-80" />
                     <h2 className="text-4xl md:text-5xl font-display font-black text-white mb-6">Security first, always.</h2>
                     <p className="text-xl text-green-100 mb-10 opacity-90">All Ratibu features are built on an institutional-grade security framework compliant with local data protection regulations.</p>
                     <Button variant="secondary" onClick={() => navigate('/create-chama')} className="bg-white text-[#00C853] hover:bg-slate-100 px-8 py-4 rounded-xl font-bold text-lg">
                         Start Free Trial
                     </Button>
                 </div>
            </section>
        </div>
    );
};

export default Features;
