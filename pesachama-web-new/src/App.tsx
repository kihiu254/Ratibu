import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/react';
import { BrowserRouter, Routes, Route, Outlet, useParams, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import CreateChama from './pages/CreateChama';

import Products from './pages/Products';
import Opportunities from './pages/Opportunities';
import Features from './pages/Features';
import Pricing from './pages/Pricing';
import Legal from './pages/Legal';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Chamas from './pages/Chamas';
import ChamaDetails from './pages/ChamaDetails';
import Profile from './pages/Profile';
import ExploreChamas from './pages/ExploreChamas';
import Rewards from './pages/Rewards';
import Admin from './pages/Admin';
import AdminLayout from './layouts/AdminLayout';
import AdminUsers from './pages/admin/AdminUsers';
import AdminChamas from './pages/admin/AdminChamas';
import AdminTransactions from './pages/admin/AdminTransactions';
import AdminChamaDetails from './pages/admin/AdminChamaDetails';
import Onboarding from './pages/Onboarding';
import OTPVerification from './pages/OTPVerification';
import MembershipKYC from './pages/MembershipKYC';

// Layout for public pages that need Navbar and Footer
const PublicLayout = () => (
  <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-midnight text-slate-900 dark:text-slate-100 transition-colors duration-300">
    <Navbar />
    <main className="flex-grow">
      <Outlet />
    </main>
    <Footer />
  </div>
);

function App() {
  useEffect(() => {
    // 1. Register Service Worker for Push Notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((reg) => {
          console.log('Service Worker Registered', reg);
          
          // Subscribe to push notifications
          if ('PushManager' in window) {
            reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: null // Add your VAPID key here
            }).then((subscription) => {
              console.log('Push subscription:', subscription);
              // Send subscription to your backend
            }).catch((err) => {
              console.log('Push subscription failed:', err);
            });
          }
        })
        .catch((err) => console.error('Service Worker Registry Failed', err));
    }

    // 2. Request Notification Permission
    if ('Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            console.log('Notification permission granted.');
            // Show welcome notification
            new Notification('Welcome to Ratibu!', {
              body: 'You will now receive important updates.',
              icon: '/ratibu-logo.png'
            });
          }
        });
      }
    }

    // 3. Offline/Online Status Management
    const handleOnline = () => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Back Online', {
          body: 'Your connection has been restored.',
          icon: '/ratibu-logo.png'
        });
      }
    };
    
    const handleOffline = () => {
      console.log('App is offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster richColors position="top-right" closeButton />
      <Analytics />
      <BrowserRouter>
        <Routes>
          {/* Public Routes with Navbar & Footer */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/create-chama" element={<CreateChama />} />
            <Route path="/product/*" element={<Products />} />
            <Route path="/products" element={<Products />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/resources/*" element={<Opportunities />} />
            <Route path="/legal/*" element={<Legal />} />
            <Route path="/features" element={<Features />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/contact" element={<Opportunities />} />
          </Route>

          {/* Auth Routes (Standalone) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Dashboard Routes (Protected) */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chamas" element={<Chamas />} />
            <Route path="/explore" element={<ExploreChamas />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/chama/:id" element={<ChamaDetails />} />
            <Route path="/activity" element={<div className="p-8 text-slate-900 dark:text-white">Activity Log (Coming Soon)</div>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/verify-otp" element={<OTPVerification />} />
            <Route path="/membership-kyc" element={<MembershipKYC />} />
          </Route>


          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Admin />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="chamas" element={<AdminChamas />} />
            <Route path="chamas/:id" element={<AdminChamaDetails />} />
            <Route path="transactions" element={<AdminTransactions />} />
          </Route>

          {/* Referral Redirect */}
          <Route path="/ref/:code" element={<ReferralRedirect />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

const ReferralRedirect = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      // Store code in session storage or similar if needed for later
      navigate(`/register?ref=${code}`);
    } else {
      navigate('/');
    }
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-midnight">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00C853]"></div>
    </div>
  );
};

export default App;
