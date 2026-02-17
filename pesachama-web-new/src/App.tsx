import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { BrowserRouter, Routes, Route, Outlet, useParams, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import CreateChama from './pages/CreateChama';

import GenericPage from './pages/GenericPage';
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
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster richColors position="top-right" closeButton />
      <BrowserRouter>
        <Routes>
          {/* Public Routes with Navbar & Footer */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/create-chama" element={<CreateChama />} />
            <Route path="/product/*" element={<GenericPage />} />
            <Route path="/solutions/*" element={<GenericPage />} />
            <Route path="/resources/*" element={<GenericPage />} />
            <Route path="/legal/*" element={<GenericPage />} />
            <Route path="/features" element={<GenericPage />} />
            <Route path="/pricing" element={<GenericPage />} />
            <Route path="/contact" element={<GenericPage />} />
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
