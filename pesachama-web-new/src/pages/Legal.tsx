import { useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Seo from '../components/Seo'

const sections = [
  {
    title: '1. What Ratibu Is',
    body:
      'Ratibu is a financial and group-operations platform for chamas, wallet transfers, savings, loans, marketplace roles, delivery workflows, rewards, penalties, and meeting coordination through web, mobile, and USSD.',
  },
  {
    title: '2. What Ratibu Is Not',
    body:
      'Ratibu is a technology platform, not a bank, not a mobile money issuer, and not a licensed deposit-taker. Where funds move through third parties, those third parties operate under their own terms, settlement timelines, outages, limits, and compliance requirements.',
  },
  {
    title: '3. Accounts, Identity, and Security',
    body:
      'You are responsible for the accuracy of your account details, phone number, KYC information, and device access. You must protect your password, PINs, SIM, recovery methods, and any OTP codes. We may suspend access where activity looks fraudulent, unsafe, or inconsistent with our rules.',
  },
  {
    title: '4. Chamas and Group Activity',
    body:
      'Chama records, contributions, withdrawals, votes, roles, swaps, meeting attendance, and governance actions are recorded to support transparency. Group admins, treasurers, secretaries, and members may have different permissions. Chama rules, contribution cycles, penalties, and approvals may be configured by the group and by Ratibu policy.',
  },
  {
    title: '5. Wallets and Transfers',
    body:
      'Wallet balances, internal transfers, savings movements, and cash-out actions may be subject to validation, score thresholds, available funds, fraud checks, settlement windows, and service availability. Some transfers are internal ledger movements, while others may rely on payment rails operated by third parties such as Safaricom M-PESA/Daraja or banking partners.',
  },
  {
    title: '6. Loans and Credit Decisions',
    body:
      'Loan products may include Chama Booster, Business Loan, and Personal Loan. Eligibility, limits, pricing, approval, and disbursement may depend on savings history, chama participation, vendor status, credit score, repayment behavior, and risk rules. Ratibu may change or pause credit offers, and approval is not guaranteed.',
  },
  {
    title: '7. Credit Score, Rewards, and Penalties',
    body:
      'Ratibu may calculate a credit score using savings history, contribution discipline, repayment behavior, role activity, meeting participation, penalties, reversals, and other platform signals. Rewards may improve your standing, while penalties, reversals, missed obligations, or risky activity may reduce it. Score-based eligibility is operational and may change over time.',
  },
  {
    title: '8. Marketplace, Roles, and Delivery',
    body:
      'Vendor, agent, and rider roles may require approval and may depend on your chama participation, score, and identity checks. Marketplace tools may include vendor payments, delivery requests, e-commerce flows, till/paybill connections, and role-based commissions. Delivery and merchant operations may involve third-party logistics, telecom, and payment providers.',
  },
  {
    title: '9. Meetings and Third-Party Tools',
    body:
      'Ratibu may link to external meeting tools such as Google Meet or similar services. If a meeting is hosted by a third-party provider, their availability and privacy terms apply in addition to Ratibu rules. Meeting links are user-visible and may be shared inside the chama context only as allowed by the group.',
  },
  {
    title: '10. USSD Usage',
    body:
      'USSD is a short, session-based channel intended for quick actions such as balances, joins, deposits, withdrawals, requests, and summaries. Because USSD is limited, long forms, file uploads, deep histories, and detailed dashboards may only be available on web or mobile.',
  },
  {
    title: '11. Data Use and Sharing',
    body:
      'We may collect account details, KYC data, phone numbers, device identifiers, transaction history, chama activity, role data, support requests, and usage logs. We may share data with service providers that help us run payments, hosting, analytics, notifications, identity checks, fraud controls, and meeting or communication services, as permitted by law and our policies.',
  },
  {
    title: '12. Risks, Limits, and Availability',
    body:
      'Financial services can fail because of network issues, third-party outages, invalid account details, wrong numbers, fraud controls, rate limits, or maintenance windows. Ratibu may apply transaction limits, review holds, reversal checks, and manual approval steps where needed.',
  },
  {
    title: '13. Fraud, Abuse, and Suspension',
    body:
      'We may monitor for suspicious activity, repeated failed requests, account takeover, policy abuse, fake identities, duplicate accounts, chargebacks, unauthorized chamas, or other risky behavior. We may delay, decline, reverse, or suspend actions to protect users, groups, and the platform.',
  },
  {
    title: '14. Disputes and Support',
    body:
      'We encourage users to resolve disputes first through the chama or support channel. Where needed, Ratibu may review logs, transaction records, role changes, and audit trails. Final outcomes may depend on evidence, third-party confirmation, and applicable law.',
  },
]

const notices = [
  'By using Ratibu through web, mobile, or USSD, you agree to the applicable terms and privacy rules for the services you use.',
  'You should only use Ratibu for lawful activity and accurate account information.',
  'If you do not agree with any part of these notices, stop using the platform and contact support before continuing.',
]

const Legal = () => {
  const location = useLocation()
  const type = location.pathname.split('/').pop() || 'legal'
  const title = type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
      <Seo
        title={`Ratibu Chama ${title}`}
        description="Ratibu Chama legal, privacy, product, and consent information for web, mobile, and USSD users in Kenya."
        canonicalPath={location.pathname}
        noIndex
      />
      <Navbar />

      <main className="flex-grow pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.3em] text-[#00C853] font-semibold mb-3">Ratibu Legal</p>
            <h1 className="text-4xl md:text-5xl font-display font-black mb-4 capitalize text-slate-900 dark:text-white">
              {title}
            </h1>
            <p className="max-w-3xl text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
              Transparent service terms for Ratibu Chamas, wallet transfers, loans, marketplace roles, USSD,
              meeting links, and third-party providers. This page is written to help users understand the platform
              before they consent to use it.
            </p>
            <div className="mt-4 h-1 w-24 bg-[#00C853] rounded-full" />
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-10">
            {notices.map((notice) => (
              <div
                key={notice}
                className="rounded-[1.5rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-lg shadow-slate-200/50 dark:shadow-none"
              >
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{notice}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-none p-6 md:p-10">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Effective date</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">April 20, 2026</p>
              </div>
              <div className="text-right">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Version</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">Ratibu transparency draft</p>
              </div>
            </div>

            <div className="space-y-8">
              {sections.map((section) => (
                <section key={section.title} className="space-y-3">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{section.title}</h2>
                  <p className="text-base md:text-lg leading-8 text-slate-600 dark:text-slate-400">{section.body}</p>
                </section>
              ))}
            </div>

            <div className="mt-10 pt-8 border-t border-slate-200 dark:border-white/10">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">15. Contact and Updates</h2>
              <p className="text-base md:text-lg leading-8 text-slate-600 dark:text-slate-400">
                We may update these notices as Ratibu products, legal obligations, and third-party services change.
                Continued use after an update means the updated terms may apply. For questions, complaints, or
                disputes, use the support channel shown inside the app or contact the Ratibu team through the
                official business channels in the product.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Legal
