import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/Button';
import { RatibuHeroLogo } from '../components/RatibuHeroLogo';
import Seo from '../components/Seo';
import { supabase } from '../lib/supabase';
import { ArrowRight, CreditCard, HandCoins, Megaphone, Users } from 'lucide-react';

const Hero = () => {
    const navigate = useNavigate();

    const goToProtectedFeature = async (path: string) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
            navigate(path)
            return
        }

        navigate(`/login?redirectTo=${encodeURIComponent(path)}`)
    }

    return (
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-28 md:pt-36 bg-slate-50 dark:bg-midnight transition-colors duration-300">
            
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
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 pointer-events-none z-1" />
            <div className="absolute inset-0 bg-white/5 dark:bg-midnight/40 z-1" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.3)_0%,transparent_100%)] dark:bg-[radial-gradient(circle_at_center,rgba(2,6,23,0.7)_0%,transparent_100%)] z-1 transition-all duration-500" />
 
            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-5xl mx-auto text-center space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    >
                         <h1 className="flex flex-col items-center mb-6 max-w-4xl mx-auto transition-colors duration-300">
                           <RatibuHeroLogo 
                               className="h-20 sm:h-28 md:h-36 lg:h-44 w-auto drop-shadow-xl -mb-2 sm:-mb-3 md:-mb-4 lg:-mb-5" 
                           />
                           <span className="text-2xl sm:text-3xl md:text-5xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight drop-shadow-md relative z-10">
                              Digital Banking.
                           </span>
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-900 dark:text-slate-200 max-w-3xl mx-auto leading-relaxed font-bold drop-shadow-sm transition-colors duration-300">
                            Ratibu Chama helps chamas, savings groups, and SMEs manage loans, contributions, USSD banking, KCB M-PESA, and KPLC bill payments in one place.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-4"
                    >
                        <Button large>Create a Chama</Button>
                        <Button variant="outline" large onClick={() => void goToProtectedFeature('/kcb-mpesa')}>
                           KCB M-PESA
                        </Button>
                        <Button variant="outline" large onClick={() => void goToProtectedFeature('/loans')}>
                           Loans
                        </Button>
                        <Button variant="outline" large onClick={() => void goToProtectedFeature('/kplc-bill')}>
                           Pay KPLC
                        </Button>
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
                        className="pt-12"
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700 dark:text-slate-400 mb-6">
                            Empowering these major sectors
                        </p>
                        <p className="mb-6 text-sm md:text-base text-slate-700 dark:text-slate-300 max-w-4xl mx-auto leading-7">
                            If you searched for Ratibu, chama, loan management, savings groups, or digital banking in Kenya, this platform is designed to help your group save together, borrow responsibly, and make payments securely.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-6xl mx-auto">
                           {["Bodabodas", "House-helps", "Sales-people", "Grocery Owners", "Waiters", "Health Workers", "Caretakers", "Drivers", "Fundis", "Conductors", "Others"].map((segment) => (
                              <button 
                                 key={segment} 
                                 onClick={() => navigate(`/create-chama?category=${encodeURIComponent(segment)}`)}
                                 className="px-3 py-1.5 glass rounded-xl border border-slate-300 dark:border-white/10 text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-white hover:bg-primary/80 hover:border-primary/50 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                              >
                                 {segment}
                              </button>
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
                        <h2 className="text-3xl sm:text-4xl md:text-6xl font-display font-black text-slate-900 dark:text-white leading-none tracking-tighter transition-colors duration-300 uppercase">
                            USSD & <br className="hidden sm:block" />MOBILE APP.
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-lg font-medium leading-relaxed transition-colors duration-300">
                            Offering a robust technology platform for the population at the bottom of the economic pyramid. Now operating in Kenya, Tanzania, and Namibia.
                        </p>
                        <div className="flex gap-4">
                           <div className="px-6 py-3 bg-white/50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 text-center flex-1 transition-colors duration-300">
                              <p className="text-primary font-black text-lg">*702*47#</p>
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

const serviceLinks = [
    { label: 'Features', href: '/features' },
    { label: 'Products', href: '/products' },
    { label: 'Loans', href: '/loans' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Opportunities', href: '/opportunities' },
    { label: 'Contact', href: '/contact' },
]

const whatRatibuDoes = [
    {
        title: 'Chama management',
        description: 'Create and manage savings groups, member activity, meetings, and contributions in one system.',
        href: '/features',
        icon: Users,
    },
    {
        title: 'Loans and statements',
        description: 'See Chama Booster, Business Loan, and Personal Loan options with transparent formulas. ',
        href: '/loans',
        icon: HandCoins,
    },
    {
        title: 'Payments and bills',
        description: 'Handle KCB M-PESA flows, utility payments, and mobile money transactions with confidence.',
        href: '/products',
        icon: CreditCard,
    },
    {
        title: 'Partnerships and growth',
        description: 'Explore agent, developer, and institutional partnership opportunities built for scale.',
        href: '/opportunities',
        icon: Megaphone,
    },
]

const WhatRatibuDoes = () => (
    <section className="py-24 bg-white dark:bg-slate-950 transition-colors duration-300">
        <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                    <div className="max-w-2xl">
                        <p className="text-xs font-black uppercase tracking-[0.4em] text-[#00C853] mb-4">What Ratibu does</p>
                        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                            A simple home for chamas, savings groups, loans, and payments.
                        </h2>
                        <p className="mt-5 text-base md:text-lg text-slate-600 dark:text-slate-400 leading-8">
                            Ratibu brings together the everyday tools groups need to save, lend, collect contributions, and keep records in one trusted platform.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {serviceLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:border-[#00C853]/40 hover:text-[#00C853] transition-colors"
                            >
                                {link.label}
                                <ArrowRight className="h-3.5 w-3.5" />
                            </a>
                        ))}
                    </div>
                </div>

                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                    {whatRatibuDoes.map((item, index) => {
                        const Icon = item.icon
                        return (
                            <motion.a
                                key={item.title}
                                href={item.href}
                                initial={{ opacity: 0, y: 18 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.08 }}
                                className="group rounded-[1.75rem] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-6 hover:-translate-y-1 hover:border-[#00C853]/30 transition-all"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00C853]/10 text-[#00C853]">
                                    <Icon className="h-6 w-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-black text-slate-900 dark:text-white">{item.title}</h3>
                                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{item.description}</p>
                            </motion.a>
                        )
                    })}
                </div>
            </div>
        </div>
    </section>
)

const faqs = [
    {
        question: 'What is Ratibu Chama?',
        answer: 'Ratibu Chama is a digital banking platform for chamas, savings groups, SACCOs, loans, USSD banking, KCB M-PESA, KPLC bill payments, and transaction statements.',
    },
    {
        question: 'Can I use Ratibu for a chama or savings group?',
        answer: 'Yes. Ratibu is built for chamas and savings groups that want to manage contributions, meetings, loans, and member activity in one place.',
    },
    {
        question: 'Does Ratibu support loan management?',
        answer: 'Yes. Ratibu helps groups track loan balances, repayments, statements, and related transaction history.',
    },
    {
        question: 'How do people access Ratibu?',
        answer: 'Users can access Ratibu through the mobile app and USSD for low-data and offline-friendly participation.',
    },
]

const FAQSection = () => (
    <section className="py-24 bg-slate-50 dark:bg-midnight transition-colors duration-300">
        <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto">
                <p className="text-xs font-black uppercase tracking-[0.4em] text-[#00C853] mb-4">People Also Ask</p>
                <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                    Common questions about Ratibu, chama banking, and loans.
                </h2>
                <div className="mt-10 space-y-4">
                    {faqs.map((faq) => (
                        <div key={faq.question} className="rounded-[1.75rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">{faq.question}</h3>
                            <p className="mt-3 text-sm md:text-base leading-7 text-slate-600 dark:text-slate-400">{faq.answer}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </section>
)

export default function Home() {
    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    }

    return (
        <main className="bg-slate-50 dark:bg-midnight min-h-screen font-sans transition-colors duration-300">
            <Seo
              title="Ratibu Chama | Digital Banking for Chamas, Savings & Loans"
              description="Ratibu Chama helps chamas, savings groups, and SMEs manage contributions, loans, USSD banking, KCB M-PESA, and KPLC bill payments in one place."
              canonicalPath="/"
              keywords={[
                'Ratibu',
                'chama',
                'loan',
                'savings group',
                'digital banking for chamas',
                'group savings platform',
                'USSD banking',
                'KCB M-PESA',
                'KPLC bill payment',
              ]}
              jsonLd={[
                {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Ratibu Chama',
                  url: 'https://www.ratibuchama.com',
                  logo: 'https://www.ratibuchama.com/logo.png',
                },
                {
                  '@context': 'https://schema.org',
                  '@type': 'WebSite',
                  name: 'Ratibu Chama',
                  url: 'https://www.ratibuchama.com',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: 'https://www.ratibuchama.com/explore?query={search_term_string}',
                    'query-input': 'required name=search_term_string',
                  },
                },
                {
                  '@context': 'https://schema.org',
                  '@type': 'WebPage',
                  name: 'Ratibu Chama Home',
                  url: 'https://www.ratibuchama.com/',
                  description: 'Digital banking for chamas, savings groups, loans, USSD banking, KCB M-PESA, and KPLC bills in Kenya.',
                },
                faqJsonLd,
              ]}
            />
            <Hero />
            <WhatRatibuDoes />
            <SolutionPillars />
            <AccessDevices />
            <FAQSection />
        </main>
    );
}
