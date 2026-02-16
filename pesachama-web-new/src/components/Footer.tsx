import { Link } from "react-router-dom";
import { RatibuLogo } from "./RatibuLogo";

const Footer = () => {
    return (
        <footer className="bg-slate-50 dark:bg-midnight text-slate-600 dark:text-slate-400 py-24 border-t border-slate-200 dark:border-white/5 relative overflow-hidden transition-colors duration-300">
            {/* Ambient Glow */}
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
                    
                    {/* Brand Column */}
                    <div className="space-y-6">
                        <Link to="/" className="flex items-center space-x-3 group">
                             <RatibuLogo className="h-16 w-auto text-slate-900 dark:text-white group-hover:scale-105 transition-transform" />
                        </Link>
                        <p className="text-sm leading-relaxed text-slate-500 max-w-xs font-medium">
                            Empowering informal investment groups with modern digital tools for transparency, 
                            security, and growth.
                        </p>
                    </div>

                    {/* Product Column */}
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-[0.2em] text-xs mb-8 transition-colors">Product</h3>
                        <ul className="space-y-4 text-sm font-bold">
                            <li><Link to="/product/mobile-app" className="hover:text-[#00C853] transition-colors">Mobile App</Link></li>
                            <li><Link to="/product/ussd-platform" className="hover:text-[#00C853] transition-colors">USSD Platform</Link></li>
                            <li><Link to="/product/web-dashboard" className="hover:text-[#00C853] transition-colors">Web Dashboard</Link></li>
                            <li><Link to="/product/integrations" className="hover:text-[#00C853] transition-colors">Integrations</Link></li>
                        </ul>
                    </div>

                    {/* Resources Column */}
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-[0.2em] text-xs mb-8 transition-colors">Resources</h3>
                        <ul className="space-y-4 text-sm font-bold">
                            <li><Link to="/resources/documentation" className="hover:text-[#00C853] transition-colors">Documentation</Link></li>
                            <li><Link to="/resources/help-center" className="hover:text-[#00C853] transition-colors">Help Center</Link></li>
                            <li><Link to="/resources/api-status" className="hover:text-[#00C853] transition-colors">API Status</Link></li>
                            <li><Link to="/resources/blog" className="hover:text-[#00C853] transition-colors">Blog</Link></li>
                        </ul>
                    </div>

                    {/* Support Column */}
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-[0.2em] text-xs mb-8 transition-colors">Contact</h3>
                        <div className="glass rounded-2xl p-5 border border-slate-200 dark:border-white/5 space-y-3 bg-white/50 dark:bg-white/5 backdrop-blur-md">
                            <p className="text-[10px] text-accent font-black uppercase tracking-widest">Global Support</p>
                            <a href="mailto:ratibumail@gmail.com" className="block text-slate-900 dark:text-white text-sm font-bold leading-tight transition-colors hover:text-[#00C853]">ratibumail@gmail.com</a>
                            <a href="tel:+254112081866" className="block text-slate-900 dark:text-white text-sm font-bold leading-tight transition-colors hover:text-[#00C853]">+254 112 081 866</a>
                            
                            <div className="pt-4 border-t border-slate-200 dark:border-white/10 mt-4">
                                <p className="text-[10px] text-accent font-black uppercase tracking-widest">Developer Contact</p>
                                <a href="mailto:1kihiupaul@gmail.com" className="block text-slate-900 dark:text-white text-sm font-bold leading-tight transition-colors hover:text-[#00C853] mt-1">1kihiupaul@gmail.com</a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-slate-200 dark:border-white/5 mt-24 pt-10 flex flex-col md:flex-row justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <p>© 2026 RATIBU ECOSYSTEMS. ALL RIGHTS RESERVED.</p>
                        <span className="hidden md:inline">|</span>
                        <a href="https://gurucrafts.agency/" target="_blank" rel="noopener noreferrer" className="hover:text-[#00C853] transition-colors">
                            Developed by GuruCrafts Agency
                        </a>
                    </div>
                    <div className="flex gap-8 mt-6 md:mt-0">
                        <Link to="/legal/privacy" className="hover:text-[#00C853] transition-colors">Privacy</Link>
                        <Link to="/legal/terms" className="hover:text-[#00C853] transition-colors">Terms</Link>
                        <Link to="/legal/cookies" className="hover:text-[#00C853] transition-colors">Cookies</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
