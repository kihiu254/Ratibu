import { motion } from 'framer-motion';
import { Smartphone, Shield, Zap, CircleDollarSign, Fingerprint, Globe, BarChart3, LockKeyhole } from 'lucide-react';
import Navbar from '../components/Navbar';

const Products = () => {
    const mainFeatures = [
        {
            title: "Digital Wallets",
            description: "Enterprise-grade digital wallets allowing SMEs and Chamas to securely store, manage, and distribute funds. Featuring multi-signature approvals for unparalleled security.",
            icon: <Smartphone className="w-10 h-10 text-white" />,
            color: "from-blue-500 to-cyan-400"
        },
        {
            title: "Chama OS",
            description: "The ultimate operating system for savings groups. Automate contributions, track transparent member balances, auto-calculate dividends, and manage loans seamlessly.",
            icon: <CircleDollarSign className="w-10 h-10 text-white" />,
            color: "from-[#00C853] to-emerald-400"
        },
        {
            title: "Instant Credit",
            description: "Algorithm-backed quick loans designed to bridge gaps. We analyze group performance and individual saving habits to disburse transparent, low-interest credit instantly.",
            icon: <Zap className="w-10 h-10 text-white" />,
            color: "from-orange-500 to-amber-400"
        },
        {
            title: "USSD Offline Access",
            description: "True financial inclusion means access without internet. Our USSD gateway ensures every member can transact, check balances, and borrow, using any basic mobile phone.",
            icon: <Globe className="w-10 h-10 text-white" />,
            color: "from-purple-500 to-indigo-400"
        }
    ];

    const securityFeatures = [
        { icon: <LockKeyhole />, title: "Bank-Level Security", desc: "256-bit encryption on all transactions." },
        { icon: <Fingerprint />, title: "Biometric Auth", desc: "FaceID and fingerprint login support." },
        { icon: <Shield />, title: "Fraud Protection", desc: "AI-driven anomaly detection." },
        { icon: <BarChart3 />, title: "Audit Trails", desc: "Immutable logs for all Chama activity." },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-midnight text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
            <Navbar />
            
            {/* Hero Section */}
            <section className="pt-40 pb-20 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00C853]/10 blur-[120px] rounded-full pointer-events-none" />
                
                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight mb-8">
                            Built for the <br />
                            <span className="text-gradient-green uppercase text-6xl md:text-8xl">Next Economy.</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium">
                            A unified financial infrastructure tailored for Chamas, SMEs, and everyday individuals. Powerful, inclusive, and transparent.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Main Products Grid */}
            <section className="py-20 bg-white dark:bg-slate-900/50 border-y border-slate-200 dark:border-white/5 relative z-10">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                        {mainFeatures.map((feature, index) => (
                            <motion.div 
                                key={feature.title}
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="group relative bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] p-10 md:p-14 overflow-hidden border border-slate-200 dark:border-white/5 hover:border-[#00C853]/50 transition-colors duration-500"
                            >
                                <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${feature.color} opacity-10 blur-[80px] group-hover:opacity-20 transition-opacity duration-500`} />
                                
                                <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-8 shadow-2xl shadow-${feature.color.split('-')[1]}/30 group-hover:scale-110 transition-transform duration-500`}>
                                    {feature.icon}
                                </div>
                                
                                <h3 className="text-3xl font-display font-black mb-6 text-slate-900 dark:text-white tracking-tight">{feature.title}</h3>
                                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                    {feature.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Security Section */}
            <section className="py-32 relative z-10">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <div className="mb-16">
                        <h2 className="text-4xl md:text-5xl font-display font-black mb-6">Uncompromising <span className="text-[#00C853]">Security</span></h2>
                        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Your funds and data are protected by industry-leading security protocols, ensuring perfect peace of mind.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {securityFeatures.map((sec, i) => (
                            <motion.div 
                                key={sec.title}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white/50 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/5 rounded-3xl p-8 hover:-translate-y-2 transition-transform duration-300"
                            >
                                <div className="text-[#00C853] mb-6 flex justify-center w-12 h-12 mx-auto">
                                    {sec.icon}
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{sec.title}</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{sec.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Products;
