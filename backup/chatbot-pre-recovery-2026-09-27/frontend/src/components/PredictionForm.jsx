// =========================================================================
// Shared guided Soil Prediction form — rendered inside every chatbot UI.
// District/Crop dropdowns + one numeric textbox per remaining field.
// The Predict button stays disabled until all 8 fields are complete & valid.
// Fully localized (English / Tamil); Tanglish resolves to Tamil.
// Tamil dropdowns show Tamil names but submit canonical English values.
// =========================================================================
import { useChatbot } from '../context/ChatbotContext'
import { formStrings, getDistrictOptions, getCropOptions, resolveFormLang } from '../services/chatbotService'

const PredictionForm = ({ compact = false }) => {
  const {
    lastLanguage, form, formErrors, formSubmitted,
    formValidation, meta, metaError,
    updateFormField, submitPredictionForm, resetPredictionForm, loading
  } = useChatbot()

  const S = formStrings(lastLanguage)
  const isTamilMode = resolveFormLang(lastLanguage) === 'Tamil'
  const districtOpts = isTamilMode ? getDistrictOptions(lastLanguage) : meta.districts.map((d) => ({ display: d, value: d }))
  const cropOpts = isTamilMode ? getCropOptions(lastLanguage) : meta.crops.map((c) => ({ display: c, value: c }))
  const showHints = formSubmitted || Object.values(form).some((v) => String(v || '').trim() !== '')
  const inputCls = (hasError) =>
    `w-full px-2 py-1.5 border rounded-lg outline-none text-xs bg-white transition-all ${
      hasError
        ? 'border-red-400 focus:ring-1 focus:ring-red-400 focus:border-red-500'
        : 'border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'
    }`

  const renderError = (key) =>
    showHints && formErrors[key] ? (
      <p className="text-[10px] text-red-600 font-semibold mt-0.5">{formErrors[key]}</p>
    ) : null

  return (
    <div className={`bg-emerald-50/60 border border-emerald-200/70 rounded-xl ${compact ? 'p-2.5' : 'p-4'} space-y-2`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold text-emerald-900">{S.formTitle}</p>
        <button
          type="button"
          onClick={resetPredictionForm}
          disabled={loading}
          className="text-[10px] font-extrabold text-emerald-700 underline hover:text-emerald-900 disabled:opacity-50"
          title={S.startNew}
        >
          {S.startNew}
        </button>
      </div>
      <p className="text-[10px] text-emerald-800/80 leading-snug">{S.formSubtitle}</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold text-gray-700 mb-0.5">{S.district} *</label>
          <select
            value={form.district}
            onChange={(e) => updateFormField('district', e.target.value)}
            className={inputCls(showHints && formErrors.district)}
          >
            <option value="">{S.ph_district}</option>
            {districtOpts.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.display}</option>
            ))}
          </select>
          {renderError('district')}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-700 mb-0.5">{S.crop} *</label>
          <select
            value={form.crop}
            onChange={(e) => updateFormField('crop', e.target.value)}
            className={`${inputCls(showHints && formErrors.crop)} capitalize`}
          >
            <option value="">{S.ph_crop}</option>
            {cropOpts.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.display}</option>
            ))}
          </select>
          {renderError('crop')}
        </div>

        {[
          { key: 'temperature', label: S.temperature, ph: S.ph_temperature },
          { key: 'humidity', label: S.humidity, ph: S.ph_humidity },
          { key: 'moisture', label: S.moisture, ph: S.ph_moisture },
          { key: 'n', label: S.n, ph: S.ph_n },
          { key: 'p', label: S.p, ph: S.ph_p },
          { key: 'k', label: S.k, ph: S.ph_k }
        ].map(({ key, label, ph }) => (
          <div key={key}>
            <label className="block text-[10px] font-bold text-gray-700 mb-0.5">{label} *</label>
            <input
              type="text"
              inputMode="decimal"
              value={form[key]}
              onChange={(e) => updateFormField(key, e.target.value)}
              placeholder={ph}
              className={inputCls(showHints && formErrors[key])}
            />
            {renderError(key)}
            {(key === 'n' || key === 'p' || key === 'k') && (
              <p className="text-[9px] text-gray-400 mt-0.5">{S.npkHint}</p>
            )}
          </div>
        ))}
      </div>

      {metaError && (
        <p className="text-[10px] text-amber-700 font-semibold">
          {lastLanguage === 'Tamil' ? 'மாவட்ட/பயிர் பட்டியல் ஏற்றப்படவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Could not load district/crop lists. You can still type the values.'}
        </p>
      )}

      <button
        type="button"
        onClick={submitPredictionForm}
        disabled={loading || !formValidation.complete}
        className="w-full py-2 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        title={formValidation.complete ? S.predict : Object.values(formErrors)[0] || S.predict}
      >
        🌱 {S.predict}
      </button>
      {showHints && !formValidation.complete && (
        <p className="text-[10px] text-red-600 font-semibold">
          {Object.values(formErrors)[0]}
        </p>
      )}
    </div>
  )
}

export default PredictionForm
