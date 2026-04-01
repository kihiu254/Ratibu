import { useEffect } from 'react'
import { BrowserRouter, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import AdminLayout from '../layouts/AdminLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import Admin from '../pages/Admin'
import ChamaDetails from '../pages/ChamaDetails'
import Chamas from '../pages/Chamas'
import CreateChama from '../pages/CreateChama'
import Dashboard from '../pages/Dashboard'
import ExploreChamas from '../pages/ExploreChamas'
import Features from '../pages/Features'
import Home from '../pages/Home'
import Legal from '../pages/Legal'
import Login from '../pages/Login'
import MembershipKYC from '../pages/MembershipKYC'
import Onboarding from '../pages/Onboarding'
import Opportunities from '../pages/Opportunities'
import OTPVerification from '../pages/OTPVerification'
import Pricing from '../pages/Pricing'
import Products from '../pages/Products'
import Profile from '../pages/Profile'
import Register from '../pages/Register'
import Rewards from '../pages/Rewards'
import PersonalSavings from '../pages/PersonalSavings'
import AdminActivities from '../pages/admin/AdminActivities'
import AdminAnalytics from '../pages/admin/AdminAnalytics'
import AdminChamaDetails from '../pages/admin/AdminChamaDetails'
import AdminChamas from '../pages/admin/AdminChamas'
import AdminKycDocuments from '../pages/admin/AdminKycDocuments'
import AdminRoles from '../pages/admin/AdminRoles'
import AdminSettings from '../pages/admin/AdminSettings'
import AdminTransactions from '../pages/admin/AdminTransactions'
import AdminUsers from '../pages/admin/AdminUsers'

const PublicLayout = () => (
  <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-midnight text-slate-900 dark:text-slate-100 transition-colors duration-300">
    <Navbar />
    <main className="flex-grow">
      <Outlet />
    </main>
    <Footer />
  </div>
)

const ReferralRedirect = () => {
  const { code } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    navigate(code ? `/register?ref=${code}` : '/')
  }, [code, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-midnight">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00C853]"></div>
    </div>
  )
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
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

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chamas" element={<Chamas />} />
          <Route path="/explore" element={<ExploreChamas />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/personal-savings" element={<PersonalSavings />} />
          <Route path="/chama/:id" element={<ChamaDetails />} />
          <Route path="/activity" element={<div className="p-8 text-slate-900 dark:text-white">Activity Log (Coming Soon)</div>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/verify-otp" element={<OTPVerification />} />
          <Route path="/membership-kyc" element={<MembershipKYC />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Admin />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="kyc-documents" element={<AdminKycDocuments />} />
          <Route path="chamas" element={<AdminChamas />} />
          <Route path="chamas/:id" element={<AdminChamaDetails />} />
          <Route path="activities" element={<AdminActivities />} />
          <Route path="roles" element={<AdminRoles />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="/ref/:code" element={<ReferralRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
