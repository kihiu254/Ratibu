import { motion } from 'framer-motion';
import Button from '../components/Button';

const Hero = () => {
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-slate-50 dark:bg-midnight transition-colors duration-300">
            
            {/* Ambient Background Video */}
            <div className="absolute inset-0 z-0">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover opacity-100"
                >
                    <source src="/African_Digital_Finance_Animation.mp4" type="video/mp4" />
                </video>
            </div>
            
            {/* Background Grid & Overlays */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-1" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-white/0 dark:from-midnight/80 dark:via-midnight/50 dark:to-midnight z-1 transition-colors duration-300" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-5xl mx-auto text-center space-y-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <span className="inline-block px-4 py-1.5 rounded-full glass-green text-primary text-xs font-black uppercase tracking-[0.2em] mb-6 border border-primary/30">
                            A CHAMA AT YOUR FINGERTIPS
                        </span>
                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-black text-slate-900 dark:text-white leading-[0.9] tracking-tighter mb-8 max-w-4xl mx-auto transition-colors duration-300">
                            RATIBU <br />
                            <span className="text-gradient-green uppercase">Digital Banking.</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium transition-colors duration-300">
                            The simple and integrated technological platform for SMEs and Chamas. Bridging the gap for the bottom of the economic pyramid.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-4"
                    >
                        <Button large>Create a Chama</Button>
                        <Button variant="outline" large className="flex items-center gap-3 group border-slate-300 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5">
                           <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                             <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[7px] border-l-accent border-b-[4px] border-b-transparent ml-0.5" />
                           </div>
                           How it Works
                        </Button>
                    </motion.div>

                    {/* PDF Target Segments Marquee/Grid */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1.5, delay: 0.5 }}
                        className="pt-20"
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-8">
                            Empowering these major sectors
                        </p>
                        <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
                           {["Bodabodas", "House-helps", "Sales-people", "Grocery Owners", "Waiters", "Health Workers", "Caretakers", "Drivers"].map((segment) => (
                              <div key={segment} className="px-4 py-2 glass rounded-xl border border-slate-200 dark:border-white/5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary hover:border-primary/30 transition-all cursor-default">
                                 {segment}
                              </div>
                           ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

const SolutionPillars = () => {
    const pillars = [
        {
            title: "Integrated Platform",
            desc: "Links SMEs and Chamas with Mobile Money, Banks, and Wakalas for seamless operations.",
            icon: "🔗"
        },
        {
            title: "Meetings Platform",
            desc: "Digital hub for meetings and contributions. Eliminating the risks of physical money handling.",
            icon: "🤝"
        },
        {
            title: "Simplified Business OS",
            desc: "Automated book-keeping and real-time financial reconciliation to prevent business collapse.",
            icon: "📊"
        }
    ];

    return (
        <section className="py-24 relative bg-slate-50 dark:bg-midnight overflow-hidden transition-colors duration-300">
            <div className="container mx-auto px-6 relative z-10">
                <div className="grid md:grid-cols-3 gap-8">
                    {pillars.map((p, i) => (
                        <motion.div
                            key={p.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="glass p-8 rounded-[32px] border border-slate-200 dark:border-white/5 group hover:border-primary/20 transition-all"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
                                {p.icon}
                            </div>
                            <h3 className="text-xl font-display font-black mb-4 text-slate-900 dark:text-white tracking-tight uppercase transition-colors duration-300">
                                {p.title}
                            </h3>
                            <p className="text-slate-600 dark:text-slate-500 text-sm leading-relaxed font-medium transition-colors duration-300">
                                {p.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

const AccessDevices = () => {
    return (
        <section className="py-24 relative overflow-hidden bg-slate-50 dark:bg-midnight transition-colors duration-300">
            <div className="container mx-auto px-6">
                <div className="glass rounded-[48px] p-12 md:p-20 border border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1 space-y-8">
                        <span className="text-accent text-xs font-black uppercase tracking-[0.3em]">Universal Access</span>
                        <h2 className="text-4xl md:text-6xl font-display font-black text-slate-900 dark:text-white leading-none tracking-tighter transition-colors duration-300">
                            USSD & <br />MOBILE APP.
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-lg font-medium leading-relaxed transition-colors duration-300">
                            Offering a robust technology platform for the population at the bottom of the economic pyramid. Now operating in Kenya, Tanzania, and Namibia.
                        </p>
                        <div className="flex gap-4">
                           <div className="px-6 py-3 bg-white/50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 text-center flex-1 transition-colors duration-300">
                              <p className="text-primary font-black text-lg">*384#</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">USSD Access</p>
                           </div>
                           <div className="px-6 py-3 bg-white/50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 text-center flex-1 transition-colors duration-300">
                              <p className="text-slate-900 dark:text-white font-black text-lg transition-colors duration-300">App Store</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Mobile Access</p>
                           </div>
                        </div>
                    </div>
                    <div className="flex-1 relative group">
                        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full group-hover:bg-primary/30 transition-colors" />
                        <img 
                           src="https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&q=80&w=1000" 
                           alt="Digital Inclusion" 
                           className="relative z-10 rounded-[32px] grayscale hover:grayscale-0 transition-all duration-1000"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function Home() {
    return (
        <main className="bg-slate-50 dark:bg-midnight min-h-screen font-sans transition-colors duration-300">
            <Hero />
            <SolutionPillars />
            <AccessDevices />
        </main>
    );
}
