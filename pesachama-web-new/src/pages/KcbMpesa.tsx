import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BadgeDollarSign, PiggyBank, Wallet, ArrowRightLeft } from 'lucide-react'

const actions = [
  {
    title: 'Savings',
    desc: 'Manage personal savings and linked goals with the same Ratibu PIN.',
    href: '/personal-savings',
    icon: PiggyBank,
  },
  {
    title: 'KPLC Electricity',
    desc: 'Pay prepaid tokens or postpaid bills from the same payment rails.',
    href: '/kplc-bill',
    icon: Wallet,
  },
  {
    title: 'Statements',
    desc: 'Download or share transaction history for your money flow.',
    href: '/statement?accountType=all&accountName=All+Transactions',
    icon: ArrowRightLeft,
  },
]

export default function KcbMpesa() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-midnight text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <section className="pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 md:p-14 text-white border border-white/10"
          >
            <div className="flex items-center gap-3 text-[#00C853] mb-4">
              <BadgeDollarSign className="w-8 h-8" />
              <span className="text-xs font-black uppercase tracking-[0.35em]">KCB M-PESA</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight">Savings, loans, and bill payments in one place.</h1>
            <p className="mt-6 max-w-3xl text-lg text-slate-300 leading-relaxed">
              Use KCB M-PESA from Ratibu to reach savings, loan, and electricity payment flows without leaving the platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/personal-savings" className="rounded-2xl bg-[#00C853] px-5 py-3 font-bold text-white">
                Open Savings
              </Link>
              <Link to="/kplc-bill" className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white">
                Pay KPLC
              </Link>
            </div>
          </motion.div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {actions.map((action, index) => {
              const Icon = action.icon
              return (
                <motion.div
                  key={action.title}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
                >
                  <Icon className="w-7 h-7 text-[#00C853]" />
                  <h2 className="mt-4 text-xl font-bold">{action.title}</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{action.desc}</p>
                  <Link to={action.href} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#00C853]">
                    Open <ArrowRightLeft className="w-4 h-4" />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
