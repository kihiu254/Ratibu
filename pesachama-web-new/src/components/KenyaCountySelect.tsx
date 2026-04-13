import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { kenyaCounties } from '../lib/kenyaCounties'

interface KenyaCountySelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function KenyaCountySelect({ label, value, onChange, placeholder = 'Select county' }: KenyaCountySelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filteredCounties = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return kenyaCounties
    return kenyaCounties.filter((county) => county.toLowerCase().includes(needle))
  }, [query])

  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-transparent focus:ring-2 focus:ring-[#00C853] text-left"
      >
        <span className={value ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400'}>
          {value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Select County</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{kenyaCounties.length} counties in Kenya</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close county picker"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  placeholder="Search county"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                {filteredCounties.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 dark:text-slate-400">No counties match your search.</div>
                ) : (
                  filteredCounties.map((county) => {
                    const selected = county === value
                    return (
                      <button
                        key={county}
                        type="button"
                        onClick={() => {
                          onChange(county)
                          setOpen(false)
                          setQuery('')
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left border-b last:border-b-0 border-slate-100 dark:border-slate-800 transition-colors ${
                          selected ? 'bg-[#00C853]/5 text-[#00C853]' : 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="font-medium">{county}</span>
                        {selected && <Check className="w-4 h-4" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
