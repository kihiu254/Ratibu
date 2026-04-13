import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { 
  User, 
  CheckCircle2, 
  Camera, 
  FileText, 
  Shield, 
  Loader2,
  ChevronRight,
  Info,
  CreditCard,
  Hash,
  Users
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { notifyAudience, notifyUser } from '../lib/notify'
import { toast } from '../utils/toast'

const CATEGORIES = [
  "Bodabodas", "House-helps", "Sales-people", "Grocery Owners", 
  "Waiters", "Health Workers", "Caretakers", "Drivers",
  "Fundis", "Conductors", "Others"
]

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to submit KYC'
}

export default function MembershipKYC() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [files, setFiles] = useState<{
    idFront: File | null;
    idBack: File | null;
    selfie: File | null;
  }>({
    idFront: null,
    idBack: null,
    selfie: null
  })
  const [personalDetails, setPersonalDetails] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    idNumber: '',
    kraPin: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
    nextOfKinRelation: '',
    categoryOther: ''
  })
  
  const navigate = useNavigate()
  const fileRefs = {
    idFront: useRef<HTMLInputElement>(null),
    idBack: useRef<HTMLInputElement>(null),
    selfie: useRef<HTMLInputElement>(null)
  }

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [type]: e.target.files![0] }))
    }
  }

  const uploadFile = async (file: File, path: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not found')

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${path}_${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(fileName)

    return publicUrl
  }

  const handleSubmit = async () => {
    if (!files.idFront || !files.idBack || !files.selfie) {
      toast.error('Please upload all required documents')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload files
      const [idFrontUrl, idBackUrl, selfieUrl] = await Promise.all([
        uploadFile(files.idFront, 'id_front'),
        uploadFile(files.idBack, 'id_back'),
        uploadFile(files.selfie, 'selfie')
      ])

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          kyc_status: 'pending',
          id_front_url: idFrontUrl,
          id_back_url: idBackUrl,
          selfie_url: selfieUrl,
          member_category: selectedCategories,
          first_name: personalDetails.firstName,
          middle_name: personalDetails.middleName,
          last_name: personalDetails.lastName,
          id_number: personalDetails.idNumber,
          kra_pin: personalDetails.kraPin,
          next_of_kin_name: personalDetails.nextOfKinName,
          next_of_kin_phone: personalDetails.nextOfKinPhone,
          next_of_kin_relation: personalDetails.nextOfKinRelation,
          category_other_specification: selectedCategories.includes('Others') ? personalDetails.categoryOther : null
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      await notifyUser({
        targetUserId: user.id,
        title: 'KYC submitted',
        message: 'Your KYC documents were submitted successfully and are pending review.',
        type: 'success',
        link: '/dashboard',
        emailSubject: 'Your KYC submission is pending review',
      })

      await notifyAudience({
        audience: 'admins',
        title: 'New KYC submission',
        message: `${personalDetails.firstName} ${personalDetails.lastName} submitted KYC for review.`,
        type: 'info',
        link: '/admin/kyc-documents',
        emailSubject: 'A new KYC submission is waiting',
      })

      toast.success('KYC submitted! Our team will review your documents.')
      navigate('/dashboard')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const isStep1Valid = selectedCategories.length > 0 && (!selectedCategories.includes('Others') || personalDetails.categoryOther.trim() !== '')
  const isStep2Valid = personalDetails.firstName && personalDetails.lastName && personalDetails.idNumber && personalDetails.kraPin && personalDetails.nextOfKinName && personalDetails.nextOfKinPhone && personalDetails.nextOfKinRelation
  const isStep3Valid = files.idFront && files.idBack && files.selfie

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Progress Stepper */}
        <div className="flex items-center justify-between mb-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                step === i ? 'bg-[#00C853] text-white shadow-lg shadow-green-500/20' : 
                step > i ? 'bg-green-100 text-[#00C853]' : 'bg-slate-200 text-slate-500'
              }`}>
                {step > i ? <CheckCircle2 className="w-6 h-6" /> : i}
              </div>
              {i < 3 && (
                <div className={`h-1 flex-1 mx-4 rounded-full ${step > i ? 'bg-green-200' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-4xl font-black mb-3">Member Category</h1>
                <p className="text-base font-medium text-slate-500">Pick the categories that best describe your profession or role.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`p-4 rounded-2xl border-2 text-sm font-bold transition-all text-left flex items-center justify-between ${
                      selectedCategories.includes(cat)
                        ? 'bg-[#00C853]/10 border-[#00C853] text-[#00C853]'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {cat}
                    {selectedCategories.includes(cat) && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                ))}
              </div>

              {selectedCategories.includes('Others') && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2"
                >
                  <label htmlFor="category-other" className="text-sm font-bold text-slate-700 dark:text-slate-300">Please specify your category</label>
                  <input
                    id="category-other"
                    type="text"
                    value={personalDetails.categoryOther}
                    onChange={(e) => setPersonalDetails(prev => ({ ...prev, categoryOther: e.target.value }))}
                    className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl focus:border-[#00C853] outline-none transition-all"
                    placeholder="e.g. Architect, Consultant, etc."
                  />
                </motion.div>
              )}

              <button
                disabled={!isStep1Valid}
                onClick={() => setStep(2)}
                className="w-full py-4 bg-[#00C853] hover:bg-green-600 text-white font-black rounded-2xl shadow-xl shadow-green-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Continue to Personal Details
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          ) : step === 2 ? (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-4xl font-black mb-3">Personal Details</h1>
                <p className="text-base font-medium text-slate-500">Provide your official identification and next of kin details.</p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="kyc-first-name" className="text-sm font-bold flex items-center gap-2">
                      First Name
                    </label>
                    <input
                      id="kyc-first-name"
                      type="text"
                      value={personalDetails.firstName}
                      onChange={(e) => setPersonalDetails(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl focus:border-[#00C853] outline-none transition-all"
                      placeholder="First Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="kyc-middle-name" className="text-sm font-bold flex items-center gap-2">
                      Middle Name
                    </label>
                    <input
                      id="kyc-middle-name"
                      type="text"
                      value={personalDetails.middleName}
                      onChange={(e) => setPersonalDetails(prev => ({ ...prev, middleName: e.target.value }))}
                      className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl focus:border-[#00C853] outline-none transition-all"
                      placeholder="Middle Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="kyc-last-name" className="text-sm font-bold flex items-center gap-2">
                      Last Name
                    </label>
                    <input
                      id="kyc-last-name"
                      type="text"
                      value={personalDetails.lastName}
                      onChange={(e) => setPersonalDetails(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl focus:border-[#00C853] outline-none transition-all"
                      placeholder="Last Name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="kyc-id-number" className="text-sm font-bold flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#00C853]" />
                      ID Number
                    </label>
                    <input
                      id="kyc-id-number"
                      type="text"
                      value={personalDetails.idNumber}
                      onChange={(e) => setPersonalDetails(prev => ({ ...prev, idNumber: e.target.value }))}
                      className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl focus:border-[#00C853] outline-none transition-all"
                      placeholder="e.g. 12345678"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="kyc-kra-pin" className="text-sm font-bold flex items-center gap-2">
                      <Hash className="w-4 h-4 text-[#00C853]" />
                      KRA PIN
                    </label>
                    <input
                      id="kyc-kra-pin"
                      type="text"
                      value={personalDetails.kraPin}
                      onChange={(e) => setPersonalDetails(prev => ({ ...prev, kraPin: e.target.value }))}
                      className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl focus:border-[#00C853] outline-none transition-all"
                      placeholder="e.g. A012345678Z"
                    />
                  </div>
                </div>

                <div className="p-6 bg-slate-100 dark:bg-slate-900/50 rounded-3xl space-y-6">
                  <h3 className="font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#00C853]" />
                    Next of Kin Details
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="next-of-kin-name" className="text-xs font-bold text-slate-500">Full Name</label>
                      <input
                        id="next-of-kin-name"
                        type="text"
                        value={personalDetails.nextOfKinName}
                        onChange={(e) => setPersonalDetails(prev => ({ ...prev, nextOfKinName: e.target.value }))}
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-[#00C853] outline-none transition-all"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="next-of-kin-phone" className="text-xs font-bold text-slate-500">Phone Number</label>
                        <input
                          id="next-of-kin-phone"
                          type="tel"
                          value={personalDetails.nextOfKinPhone}
                          onChange={(e) => setPersonalDetails(prev => ({ ...prev, nextOfKinPhone: e.target.value }))}
                          className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-[#00C853] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="next-of-kin-relation" className="text-xs font-bold text-slate-500">Relation</label>
                        <input
                          id="next-of-kin-relation"
                          type="text"
                          value={personalDetails.nextOfKinRelation}
                          onChange={(e) => setPersonalDetails(prev => ({ ...prev, nextOfKinRelation: e.target.value }))}
                          className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-[#00C853] outline-none transition-all"
                          placeholder="e.g. Spouse, Parent, etc."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition-all"
                >
                  Back
                </button>
                <button
                  disabled={!isStep2Valid}
                  onClick={() => setStep(3)}
                  className="flex-1 py-4 bg-[#00C853] hover:bg-green-600 text-white font-black rounded-2xl shadow-xl shadow-green-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Continue to ID Verification
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-black mb-2">Identify Verification</h1>
                <p className="text-slate-500">Securely upload your ID documents for verification.</p>
              </div>

              <div className="space-y-6">
                {/* ID Front */}
                <button
                  type="button"
                  onClick={() => fileRefs.idFront.current?.click()}
                  className="w-full p-6 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl cursor-pointer hover:border-[#00C853] transition-colors relative h-40 flex flex-col items-center justify-center overflow-hidden"
                >
                  {files.idFront ? (
                    <div className="text-center">
                       <CheckCircle2 className="w-8 h-8 text-[#00C853] mb-2 mx-auto" />
                       <span className="text-sm font-bold text-[#00C853]">{files.idFront.name}</span>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="font-bold text-slate-500">ID FRONT IMAGE</span>
                      <p className="text-xs text-slate-400 mt-1">Click to upload or take a photo</p>
                    </>
                  )}
                  <input
                    type="file"
                    ref={fileRefs.idFront}
                    onChange={(e) => handleFileChange(e, 'idFront')}
                    className="hidden"
                    accept="image/*"
                    aria-label="Upload front of ID"
                    title="Upload front of ID"
                  />
                </button>

                {/* ID Back */}
                <button
                  type="button"
                  onClick={() => fileRefs.idBack.current?.click()}
                  className="w-full p-6 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl cursor-pointer hover:border-[#00C853] transition-colors relative h-40 flex flex-col items-center justify-center overflow-hidden"
                >
                  {files.idBack ? (
                    <div className="text-center">
                       <CheckCircle2 className="w-8 h-8 text-[#00C853] mb-2 mx-auto" />
                       <span className="text-sm font-bold text-[#00C853]">{files.idBack.name}</span>
                    </div>
                  ) : (
                    <>
                      <FileText className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="font-bold text-slate-500">ID BACK IMAGE</span>
                      <p className="text-xs text-slate-400 mt-1">Click to upload or take a photo</p>
                    </>
                  )}
                  <input
                    type="file"
                    ref={fileRefs.idBack}
                    onChange={(e) => handleFileChange(e, 'idBack')}
                    className="hidden"
                    accept="image/*"
                    aria-label="Upload back of ID"
                    title="Upload back of ID"
                  />
                </button>

                {/* Selfie */}
                <button
                  type="button"
                  onClick={() => fileRefs.selfie.current?.click()}
                  className="w-full p-6 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl cursor-pointer hover:border-[#00C853] transition-colors relative h-40 flex flex-col items-center justify-center overflow-hidden"
                >
                  {files.selfie ? (
                    <div className="text-center">
                       <CheckCircle2 className="w-8 h-8 text-[#00C853] mb-2 mx-auto" />
                       <span className="text-sm font-bold text-[#00C853]">{files.selfie.name}</span>
                    </div>
                  ) : (
                    <>
                      <User className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="font-bold text-slate-500">SELFIE PHOTO</span>
                      <p className="text-xs text-slate-400 mt-1">Ensure your face is clearly visible</p>
                    </>
                  )}
                  <input
                    type="file"
                    ref={fileRefs.selfie}
                    onChange={(e) => handleFileChange(e, 'selfie')}
                    className="hidden"
                    accept="image/*"
                    aria-label="Upload selfie photo"
                    title="Upload selfie photo"
                  />
                </button>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex gap-3">
                <Info className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Your information is encrypted and securely stored. We only use it for identity verification purposes in accordance with our privacy policy.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition-all"
                >
                  Back
                </button>
                <button
                  disabled={loading || !isStep3Valid}
                  onClick={handleSubmit}
                  className="flex-1 py-4 bg-[#00C853] hover:bg-green-600 text-white font-black rounded-2xl shadow-xl shadow-green-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      SUBMIT FOR VERIFICATION
                      <Shield className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
