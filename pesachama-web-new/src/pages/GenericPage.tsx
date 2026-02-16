
import Navbar from '../components/Navbar';
import { useLocation } from 'react-router-dom';

export default function GenericPage() {
  const location = useLocation();
  
  // Convert path "/legal/privacy-policy" to "Privacy Policy"
  const title = location.pathname
    .split('/')
    .pop()
    ?.replace(/-/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase()) || 'Page';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 flex flex-col transition-colors duration-300">
      <Navbar />
      
      <main className="flex-grow pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#00C853] to-green-600 bg-clip-text text-transparent mb-6 capitalize">
              {title}
            </h1>
            <div className="h-1 w-20 bg-[#00C853] rounded-full" />
          </div>
          
          <div className="prose prose-lg max-w-none prose-slate dark:prose-invert">
            <p className="text-slate-600 dark:text-slate-400 text-xl leading-relaxed mb-8">
              This page is currently under construction. The <strong>{title}</strong> content will be available soon as part of the Ratibu platform launch.
            </p>
            
            <div className="p-6 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl backdrop-blur-sm">
              <h3 className="text-slate-900 dark:text-white font-semibold mb-2">Coming Soon</h3>
              <p className="text-slate-500">
                We are working hard to bring you the full Ratibu experience. Check back later for updates.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
