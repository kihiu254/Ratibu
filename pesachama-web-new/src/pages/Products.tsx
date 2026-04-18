import { Smartphone, CircleDollarSign, Globe, Landmark, Bolt, HandCoins, ArrowLeftRight, ShieldCheck } from 'lucide-react';
import Navbar from '../components/Navbar';
import Seo from '../components/Seo';

const Products = () => {
    const mainFeatures = [
        {
            title: "Digital Wallets",
            icon: <Smartphone className="w-10 h-10 text-white" />,
            color: "from-blue-500 to-cyan-400"
        },
        {
            title: "Chama OS",
            icon: <CircleDollarSign className="w-10 h-10 text-white" />,
            color: "from-[#00C853] to-emerald-400"
        },
        {
            title: "Loans & Credit",
            icon: <HandCoins className="w-10 h-10 text-white" />,
            color: "from-orange-500 to-amber-400"
        },
        {
            title: "USSD Offline Access",
            icon: <Globe className="w-10 h-10 text-white" />,
            color: "from-purple-500 to-indigo-400"
        },
        {
            title: "KCB M-PESA",
            icon: <Landmark className="w-10 h-10 text-white" />,
            color: "from-emerald-500 to-green-400"
        },
        {
            title: "KPLC Bills",
            icon: <Bolt className="w-10 h-10 text-white" />,
            color: "from-amber-500 to-orange-400"
        },
        {
            title: "Standing Orders",
            icon: <ArrowLeftRight className="w-10 h-10 text-white" />,
            color: "from-slate-600 to-slate-400"
        },
        {
            title: "Secure Payments",
            icon: <ShieldCheck className="w-10 h-10 text-white" />,
            color: "from-cyan-600 to-sky-400"
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-midnight text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
            <Seo
              title="Ratibu Chama Products"
              description="Ratibu Chama products."
              canonicalPath="/products"
              keywords={['Ratibu products', 'digital wallets Kenya', 'chama OS']}
            />
            <Navbar />

            <section className="pt-28 pb-20 relative z-10">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {mainFeatures.map((feature) => (
                            <div
                              key={feature.title}
                              className="group rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6"
                            >
                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg`}>
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                    {feature.title}
                                </h3>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Products;
