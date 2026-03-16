import { Bell, ShieldCheck, Palette, Settings, CheckCircle, AlertTriangle } from 'lucide-react'

export default function AdminSettings() {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  const pushReady = Boolean(vapidKey)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Settings</h1>
        <p className="text-slate-500">System configuration overview and operational status.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#00C853]/10 flex items-center justify-center text-[#00C853]">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Push Notifications</h3>
              <p className="text-xs text-slate-500">Service worker + VAPID key</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold">
            {pushReady ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-green-600">Configured</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-amber-600">Missing VAPID key</span>
              </>
            )}
          </div>
          {!pushReady && (
            <p className="text-xs text-slate-500 mt-3">
              Add `VITE_VAPID_PUBLIC_KEY` to your frontend environment to enable browser push subscriptions.
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Branding Assets</h3>
              <p className="text-xs text-slate-500">Storage bucket: `branding`</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Upload logos and brand visuals to the `branding` storage bucket. Public read access is enabled for assets
            used across web and email templates.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Security & Compliance</h3>
              <p className="text-xs text-slate-500">KYC + audit readiness</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Use the KYC Documents page to review and approve submissions. Audit logs are stored in the `audit_logs`
            table for traceability.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600">
            <Settings className="w-5 h-5" />
          </div>
          <h3 className="font-black text-slate-900 dark:text-white">Operational Notes</h3>
        </div>
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-disc pl-5">
          <li>Ensure `.htaccess` rewrite rules are active for SPA routing on cPanel.</li>
          <li>Rebuild the site after changing environment variables to propagate new settings.</li>
          <li>Use the Admin Users page to manage roles and verify member profiles.</li>
        </ul>
      </div>
    </div>
  )
}
