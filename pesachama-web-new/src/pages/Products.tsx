import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, BadgeDollarSign, RadioTower, ShieldCheck, ShoppingBag, Store, Truck } from 'lucide-react'
import Navbar from '../components/Navbar'
import Seo from '../components/Seo'
import { supabase } from '../lib/supabase'

const products = [
  {
    title: 'Send Money',
    description: 'Move money to other Ratibu members from your wallet at a very low cost.',
    icon: ArrowLeftRight,
    color: 'from-sky-500 to-cyan-400',
    tag: 'Wallet transfer',
  },
  {
    title: 'Vendor Payments',
    description: 'Each vendor gets a till number for products and services paid through Ratibu.',
    icon: Store,
    color: 'from-emerald-500 to-green-400',
    tag: 'Till numbers',
  },
  {
    title: 'Agent Products',
    description: 'Agents receive an agent number to handle onboarding, collections, and service sales.',
    icon: RadioTower,
    color: 'from-orange-500 to-amber-400',
    tag: 'Agent numbers',
  },
  {
    title: 'Delivery',
    description: 'Riders receive delivery tasks and get paid once orders are confirmed.',
    icon: Truck,
    color: 'from-violet-500 to-fuchsia-400',
    tag: 'Rider work',
  },
  {
    title: 'E-commerce',
    description: 'Browse products from approved vendors, add to cart, and complete checkout inside Ratibu.',
    icon: ShoppingBag,
    color: 'from-blue-600 to-indigo-400',
    tag: 'Product catalog',
  },
  {
    title: 'Secure Wallet Rail',
    description: 'All transfers, settlements, and payments are backed by Ratibu wallet and bank/mobile rails.',
    icon: BadgeDollarSign,
    color: 'from-teal-500 to-emerald-400',
    tag: 'Low-cost payments',
  },
]

const roleRules = [
  { role: 'Vendor', score: '600+', description: 'Eligible to receive a till number and sell products or services.' },
  { role: 'Rider', score: '650+', description: 'Eligible to receive delivery jobs and rider payouts.' },
  { role: 'Agent', score: '700+', description: 'Eligible to receive an agent number and manage service operations.' },
]

const Products = () => {
  const navigate = useNavigate()

  async function handleCheckCreditScore() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      navigate('/marketplace')
      return
    }
    navigate('/login?redirectTo=/marketplace')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-midnight text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
      <Seo
        title="Ratibu Products"
        description="Ratibu products for wallet transfers, vendors, agents, riders, delivery, and e-commerce."
        canonicalPath="/products"
        keywords={['Ratibu products', 'send money Kenya', 'vendor till number', 'agent number', 'rider delivery']}
      />
      <Navbar />

      <main className="pt-36 md:pt-44 pb-20 relative">
        <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-[#00C853]/10 to-transparent pointer-events-none" />
        <section className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#00C853]">Ratibu Products</p>
            <h1 className="mt-4 text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white">
              Products that move money, goods, and work for Ratibu users.
            </h1>
            <p className="mt-5 max-w-3xl text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
              Available products live here, not inside the dashboard. Ratibu users can send money, pay vendors, access agent services, request delivery, and shop from approved sellers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleCheckCreditScore()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#00C853] px-5 py-3 font-black text-white shadow-lg shadow-[#00C853]/20"
              >
                <ShieldCheck className="h-4 w-4" />
                Check credit score
              </button>
              <span className="inline-flex items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                Roles are controlled by rewards and penalty score checks.
              </span>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {roleRules.map((rule) => (
              <div
                key={rule.role}
                className="rounded-[1.75rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm"
              >
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">{rule.score}</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{rule.role}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{rule.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {products.map((product) => {
              const Icon = product.icon
              return (
                <article
                  key={product.title}
                  className="group rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${product.color} shadow-lg`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="mt-5 inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                    {product.tag}
                  </div>
                  <h3 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">{product.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">{product.description}</p>
                </article>
              )
            })}
          </div>

          <div className="mt-14 rounded-[2rem] border border-slate-200 dark:border-white/10 bg-slate-900 text-white p-6 md:p-8">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-[#00C853]">How It Works</p>
              <h2 className="mt-3 text-3xl font-black">Vendors, agents, and riders are unlocked by credit score.</h2>
              <p className="mt-3 text-slate-300 leading-7">
                Your score is shaped by rewards and penalties. Good savings habits, successful payments, and reliable activity improve your score. Failed payments, disputes, and penalty events reduce it.
              </p>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="font-black text-white">Rewards</p>
                <p className="mt-2 text-slate-300">On-time transactions, positive activity, referrals, and consistent contributions.</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="font-black text-white">Penalties</p>
                <p className="mt-2 text-slate-300">Late repayments, chargebacks, failed deliveries, and policy violations.</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="font-black text-white">Score-based access</p>
                <p className="mt-2 text-slate-300">Vendor 600+, Rider 650+, Agent 700+ before role approval.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Products
