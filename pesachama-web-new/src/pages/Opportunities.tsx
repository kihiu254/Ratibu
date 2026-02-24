import { motion } from 'framer-motion';
import { Network, TrendingUp, Handshake, Lightbulb, ArrowRight, Wallet, Users, Sparkles } from 'lucide-react';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';

const Opportunities = () => {
    const navigate = useNavigate();

    const opportunities = [
        {
            title: "Agent Partnerships",
            description: "Become a licensed Ratibu agent. Earn lucrative commissions by onboarding local saving groups, SACCOs, and SMEs into our digital ecosystem.",
            icon: <Handshake className="w-8 h-8 text-white" />,
            color: "from-[#00C853] to-emerald-400"
        },
        {
            title: "Developer APIs",
            description: "Build the future of African fintech. Integrate our robust ledger, KYC, and wallet APIs directly into your own enterprise applications.",
            icon: <Network className="w-8 h-8 text-white" />,
            color: "from-blue-500 to-indigo-500"
        },
        {
            title: "Institutional Investment",
            description: "Access curated, high-yield pools. We connect institutional capital with vetted, high-performing Chamas for secure, impact-driven returns.",
            icon: <TrendingUp className="w-8 h-8 text-white" />,
            color: "from-orange-500 to-amber-500"
        },
        {
            title: "Innovation Grants",
            description: "Building something revolutionary for the informal sector? Apply for our quarterly Ratibu Innovators Grant to get seed funding and API credits.",
            icon: <Lightbulb className="w-8 h-8 text-white" />,
            color: "from-purple-500 to-pink-500"
        }
    ];

    const stats = [
        { label: "Active Agents", value: "2,500+", icon: <Users /> },
        { label: "API Calls / Day", value: "1M+", icon: <Network /> },
        { label: "Capital Deployed", value: "$5M+", icon: <Wallet /> },
        { label: "Grants Awarded", value: "50+", icon: <Sparkles /> },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
            <Navbar />
            
            {/* Hero Banner */}
            <section className="pt-40 pb-20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 dark:bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />
                
                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight mb-6">
                            Grow with <span className="text-gradient-green uppercase text-6xl md:text-8xl block mt-2">Ratibu.</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium mb-10">
                            Whether you're a developer, investor, or community leader, the Ratibu ecosystem provides the infrastructure for you to scale.
                        </p>
                        
                        <div className="flex flex-wrap justify-center gap-4">
                           <Button onClick={() => navigate('/register')} className="bg-[#00C853] text-white px-8 py-4 rounded-xl text-lg hover:shadow-lg hover:shadow-[#00C853]/30">
                              Become a Partner
                           </Button>
                           <Button variant="secondary" onClick={() => navigate('/contact')} className="px-8 py-4 rounded-xl text-lg">
                              Contact Sales
                           </Button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Stats Bar */}
            <section className="py-12 border-y border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/5 backdrop-blur-sm relative z-10">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {stats.map((stat, i) => (
                            <motion.div 
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="text-center"
                            >
                                <div className="text-3xl md:text-5xl font-display font-black text-slate-900 dark:text-white mb-2 tracking-tight">{stat.value}</div>
                                <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Opportunities Grid */}
            <section className="py-32 relative z-10">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="mb-16">
                        <h2 className="text-4xl md:text-5xl font-display font-black mb-6">Explore <span className="text-[#00C853]">Pathways</span></h2>
                        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">Find the perfect partnership model to align your goals with our ecosystem's growth.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {opportunities.map((opp, index) => (
                            <motion.div 
                                key={opp.title}
                                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.6 }}
                                className="group relative bg-white dark:bg-slate-900 rounded-[2rem] p-10 overflow-hidden border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 shadow-xl shadow-slate-200/50 dark:shadow-none"
                            >
                                <div className="flex flex-col sm:flex-row gap-8 items-start relative z-10">
                                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${opp.color} flex items-center justify-center shrink-0 shadow-lg`}>
                                        {opp.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white">{opp.title}</h3>
                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                                            {opp.description}
                                        </p>
                                        <button className="flex items-center text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-white group-hover:text-[#00C853] transition-colors">
                                            Learn More <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Opportunities;
