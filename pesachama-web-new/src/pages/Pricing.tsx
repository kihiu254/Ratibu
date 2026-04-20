import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import Seo from '../components/Seo';

const Pricing = () => {
    const navigate = useNavigate();

    const plans = [
        {
            name: "Basic Chama",
            price: "Free",
            description: "Perfect for small family and friends savings groups.",
            features: [
                "Up to 15 members",
                "Basic ledger tracking",
                "USSD Access",
                "Email support"
            ],
            missing: [
                "Automated M-Pesa deductions",
                "Multi-signature approvals",
                "Custom reporting",
                "API Access"
            ],
            cta: "Get Started",
            highlighted: false
        },
        {
            name: "Pro Sacco",
            price: "KES 1,500",
            period: "/month",
            description: "Advanced tools for growing investment groups and SACCOs.",
            features: [
                "Unlimited members",
                "Advanced automated ledgers",
                "Full USSD & App Access",
                "Automated M-Pesa collections",
                "Multi-sig withdrawal approvals",
                "Priority 24/7 support"
            ],
            missing: [
                "Custom API integrations",
                "White-labeling"
            ],
            cta: "Start 14-Day Free Trial",
            highlighted: true,
            badge: "Most Popular"
        },
        {
            name: "Enterprise API",
            price: "Custom",
            description: "Tailored infrastructure for fintechs and large institutions.",
            features: [
                "Everything in Pro Sacco",
                "Full White-labeling",
                "Dedicated Account Manager",
                "Custom API Integrations",
                "On-premise deployment options",
                "SLA Guarantees"
            ],
            missing: [],
            cta: "Contact Sales",
            highlighted: false
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-midnight text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
            <Seo
              title="Ratibu Chama Pricing"
              description="Compare Ratibu Chama pricing plans for small groups, growing SACCOs, chamas, and enterprise fintech integrations."
              canonicalPath="/pricing"
              keywords={[
                'Ratibu pricing',
                'chama pricing',
                'SACCO pricing',
                'group savings plans',
                'enterprise fintech',
                'digital banking pricing',
              ]}
            />
            <Navbar />
            
            <section className="pt-40 pb-20 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00C853]/10 blur-[100px] rounded-full pointer-events-none" />
                
                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight mb-6">
                            Simple, transparent <span className="text-gradient-green">pricing.</span>
                        </h1>
                        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium mb-16">
                            No hidden fees. No surprise charges. Choose the tier that fits your group's size and ambitions.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto text-left">
                        {plans.map((plan, i) => (
                            <motion.div 
                                key={plan.name}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1, duration: 0.5 }}
                                className={`relative bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border transition-all duration-300 flex flex-col ${
                                    plan.highlighted 
                                        ? 'border-[#00C853] shadow-2xl shadow-[#00C853]/20 md:-translate-y-4' 
                                        : 'border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 shadow-xl shadow-slate-200/50 dark:shadow-none'
                                }`}
                            >
                                {plan.badge && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#00C853] to-emerald-400 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                                        {plan.badge}
                                    </div>
                                )}
                                
                                <div className="mb-8">
                                    <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">{plan.name}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 h-10">{plan.description}</p>
                                </div>
                                
                                <div className="mb-8 pb-8 border-b border-slate-100 dark:border-white/5">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-display font-black tracking-tight text-slate-900 dark:text-white">{plan.price}</span>
                                        {plan.period && <span className="text-slate-500 font-medium">{plan.period}</span>}
                                    </div>
                                </div>
                                
                                <div className="flex-1 space-y-4 mb-8">
                                    {plan.features.map(f => (
                                        <div key={f} className="flex items-start gap-3">
                                            <div className="w-5 h-5 rounded-full bg-[#00C853]/10 flex items-center justify-center shrink-0 mt-0.5">
                                                <Check className="w-3 h-3 text-[#00C853]" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{f}</span>
                                        </div>
                                    ))}
                                    {plan.missing.map(m => (
                                        <div key={m} className="flex items-start gap-3 opacity-50">
                                            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                                                <X className="w-3 h-3 text-slate-400" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-500">{m}</span>
                                        </div>
                                    ))}
                                </div>
                                
                                <Button 
                                    onClick={() => navigate('/register')}
                                    variant={plan.highlighted ? 'primary' : 'secondary'}
                                    className={`w-full py-4 text-sm font-bold rounded-xl ${plan.highlighted ? 'bg-[#00C853] text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10'}`}
                                >
                                    {plan.cta}
                                </Button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Pricing;
