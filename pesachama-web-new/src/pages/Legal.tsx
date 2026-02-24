import Navbar from '../components/Navbar';
import { useLocation } from 'react-router-dom';

const Legal = () => {
    const location = useLocation();
    const type = location.pathname.split('/').pop() || 'legal';
    
    // Simplified formatting based on the URL path
    const title = type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
            <Navbar />
            
            <main className="flex-grow pt-32 pb-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-12">
                        <h1 className="text-4xl md:text-5xl font-display font-black mb-6 capitalize text-slate-900 dark:text-white">
                            {title}
                        </h1>
                        <div className="h-1 w-20 bg-[#00C853] rounded-full" />
                    </div>
                    
                    <div className="prose prose-lg max-w-none prose-slate dark:prose-invert">
                        <p className="text-slate-600 dark:text-slate-400 text-xl leading-relaxed mb-8">
                            Effective Date: October 1, 2026
                        </p>
                        
                        <div className="p-8 md:p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none">
                            <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
                            <p className="text-slate-600 dark:text-slate-400 mb-8">
                                Welcome to Ratibu. These {title} documents represent the legal agreement between Ratibu Ecosystems ("we", "us", or "our") and you, the user. By accessing or using our platform via mobile application, USSD, or web dashboard, you agree to be bound by these policies.
                            </p>

                            <h2 className="text-2xl font-bold mb-4">2. Data Protection & Privacy</h2>
                            <p className="text-slate-600 dark:text-slate-400 mb-8">
                                We prioritize the security of your financial and personal data. All data is encrypted at rest and in transit using industry-standard protocols. We comply with all relevant local data protection regulations regarding the processing of KYC and group financial data.
                            </p>

                            <h2 className="text-2xl font-bold mb-4">3. Financial Compliance</h2>
                            <p className="text-slate-600 dark:text-slate-400 mb-8">
                                Ratibu acts as a technology provider for informal savings groups (Chamas) and SMEs. We are not a bank. All funds are held in trust by our licensed banking and mobile money partners. Users are responsible for ensuring their groups operate legally within their respective jurisdictions.
                            </p>

                            <h2 className="text-2xl font-bold mb-4">4. Dispute Resolution</h2>
                            <p className="text-slate-600 dark:text-slate-400 mb-8">
                                Any disputes arising from the use of the platform will first be attempted to be resolved through our internal mediation channels. Should mediation fail, disputes will be settled through binding arbitration in Nairobi, Kenya.
                            </p>

                            <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/10 text-sm text-slate-500">
                                This is a standardized template document. For specific inquiries regarding our legal policies, please contact our legal team at legal@ratibu.com.
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Legal;
