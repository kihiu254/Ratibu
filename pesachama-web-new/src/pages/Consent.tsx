import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Seo from '../components/Seo'

const points = [
  'Ratibu uses wallet, chama, loans, marketplace, USSD, and meeting features that may rely on third-party providers.',
  'Your credit score, rewards, penalties, and eligibility can change based on behavior, repayment, and group participation.',
  'Loans, vendor roles, agent roles, rider roles, and transaction approvals are not guaranteed and may require review.',
  'Payments, settlement, and meeting links can be delayed or interrupted by network, partner, or device issues.',
]

const Consent = () => {
  const navigate = useNavigate()
  const [understood, setUnderstood] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Seo
        title="Ratibu Consent"
        description="Read Ratibu's service, privacy, financial, and third-party disclosure summary before continuing."
        canonicalPath="/consent"
        noIndex
      />
      <Navbar />

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.3em] text-[#00C853] font-semibold mb-3">Consent Screen</p>
            <h1 className="text-4xl md:text-5xl font-display font-black text-slate-900 dark:text-white mb-4">
              Review before you continue
            </h1>
            <p className="text-lg leading-8 text-slate-600 dark:text-slate-400">
              This summary explains the key things you are agreeing to when you use Ratibu. It is not a replacement
              for the full legal page. Please read both before you continue.
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="grid gap-4 md:grid-cols-2 mb-8">
              {points.map((point) => (
                <div
                  key={point}
                  className="rounded-[1.5rem] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 p-5"
                >
                  <p className="text-sm md:text-base leading-7 text-slate-700 dark:text-slate-300">{point}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3 text-sm md:text-base leading-7 text-slate-600 dark:text-slate-400">
              <p>By continuing, you confirm that you have read the full legal page and understand how Ratibu works.</p>
              <p>You also confirm that you understand payment and loan activity may be reviewed for risk and compliance.</p>
              <p>If you do not agree, do not continue and contact support before creating or using an account.</p>
            </div>

            <label className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 p-4 text-sm md:text-base text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-1"
              />
              <span>I have read the consent summary and understand I must accept the full terms before using Ratibu.</span>
            </label>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => navigate('/legal/terms')}
                className="px-5 py-3 rounded-xl border border-slate-300 dark:border-white/10 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                Read full legal page
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                disabled={!understood}
                className="px-5 py-3 rounded-xl bg-[#00C853] text-white font-semibold hover:bg-[#00C853]/90 transition-colors"
              >
                Continue to Register
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                disabled={!understood}
                className="px-5 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:opacity-90 transition-opacity"
              >
                Continue to Login
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Consent
