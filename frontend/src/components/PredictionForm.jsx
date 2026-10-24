// =========================================================================
// Shared guided Soil Prediction form — rendered inside every chatbot UI.
// Extended with hardware-ready Live Sensor (Future IoT) mode.
// District/Crop dropdowns + numeric textboxes / live telemetry.
// The Predict button stays disabled until all 8 fields are complete & valid.
// Fully localized (English / Tamil); Tanglish resolves to Tamil.
// =========================================================================
import { useState, useEffect } from 'react'
import { useChatbot } from '../context/ChatbotContext'
import { formStrings, getDistrictOptions, getCropOptions, resolveFormLang } from '../services/chatbotService'
import { fetchSensorStatus, fetchLatestReading } from '../services/sensorService'

const PredictionForm = ({ compact = false }) => {
  const {
    lastLanguage, form, formErrors, formSubmitted,
    formValidation, meta, metaError,
    updateFormField, submitPredictionForm, resetPredictionForm, loading
  } = useChatbot()

  const [entryMode, setEntryMode] = useState('manual') // 'manual' | 'sensor'
  const [sensorStatus, setSensorStatus] = useState(null)
  const [sensorReading, setSensorReading] = useState(null)
  const [fetchingSensor, setFetchingSensor] = useState(false)
  const [sensorNotice, setSensorNotice] = useState('')

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

  // Query genuine sensor status and latest telemetry
  const refreshSensorData = async () => {
    setFetchingSensor(true)
    setSensorNotice('')
    try {
      const status = await fetchSensorStatus()
      setSensorStatus(status)

      if (status.connected) {
        const latest = await fetchLatestReading()
        if (latest && latest.reading) {
          setSensorReading(latest.reading)
          // Populate environmental readings from verified sensor
          updateFormField('temperature', String(latest.reading.temperature))
          updateFormField('humidity', String(latest.reading.humidity))
          updateFormField('moisture', String(latest.reading.moisture))

          // NPK scores: populate ONLY if calibrated
          if (latest.reading.calibratedNpk && latest.reading.calibratedNpk.isCalibrated) {
            if (latest.reading.calibratedNpk.nScore !== null) updateFormField('n', String(latest.reading.calibratedNpk.nScore))
            if (latest.reading.calibratedNpk.pScore !== null) updateFormField('p', String(latest.reading.calibratedNpk.pScore))
            if (latest.reading.calibratedNpk.kScore !== null) updateFormField('k', String(latest.reading.calibratedNpk.kScore))
          }
        } else {
          setSensorReading(null)
        }
      } else {
        setSensorReading(null)
      }
    } catch (err) {
      setSensorNotice(isTamilMode ? 'சென்சார் நிலையை பெற முடியவில்லை.' : 'Could not query sensor API status.')
    } finally {
      setFetchingSensor(false)
    }
  }

  useEffect(() => {
    if (entryMode === 'sensor') {
      refreshSensorData()
    }
  }, [entryMode])

  const formatTimestamp = (ts) => {
    if (!ts) return null
    try {
      const d = new Date(ts)
      return isNaN(d.getTime()) ? null : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return null
    }
  }

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

      {/* Mode Switcher: Manual Entry vs Live Sensor */}
      <div className="flex bg-emerald-100/70 p-0.5 rounded-lg text-[10px] font-bold">
        <button
          type="button"
          onClick={() => setEntryMode('manual')}
          className={`flex-1 py-1 rounded-md transition-all ${
            entryMode === 'manual'
              ? 'bg-white text-emerald-800 shadow-2xs'
              : 'text-emerald-700 hover:text-emerald-900'
          }`}
        >
          ✏️ {S.modeManual || 'Manual Entry'}
        </button>
        <button
          type="button"
          onClick={() => setEntryMode('sensor')}
          className={`flex-1 py-1 rounded-md transition-all ${
            entryMode === 'sensor'
              ? 'bg-white text-emerald-800 shadow-2xs'
              : 'text-emerald-700 hover:text-emerald-900'
          }`}
        >
          📡 {S.modeSensor || 'Live Sensor (Future IoT)'}
        </button>
      </div>

      {/* Live Sensor Mode Telemetry & Hardware Status Card */}
      {entryMode === 'sensor' && (
        <div className="bg-white/90 border border-emerald-200 rounded-lg p-2.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  sensorStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                }`}
              />
              <span className="text-[10px] font-extrabold text-gray-700">
                {sensorStatus?.connected
                  ? S.sensorConnected || 'Connected'
                  : sensorStatus?.status === 'Stale'
                  ? S.sensorStale || 'Stale'
                  : S.sensorNotConnected || 'Not Connected'}
              </span>
            </div>

            <button
              type="button"
              onClick={refreshSensorData}
              disabled={fetchingSensor}
              className="text-[9px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold disabled:opacity-50"
            >
              {fetchingSensor ? '...' : `↻ ${S.refreshReadings || 'Refresh Readings'}`}
            </button>
          </div>

          {!sensorStatus?.connected && (
            <p className="text-[10px] text-gray-600 bg-gray-50 border border-gray-100 p-2 rounded-md leading-relaxed">
              {S.noSensorMsg || 'No sensor device is connected. Connect an ESP32 device to receive live readings.'}
            </p>
          )}

          {sensorStatus?.connected && sensorReading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] text-gray-500">
                <span>{S.lastReadingTime || 'Last Reading'}: {formatTimestamp(sensorReading.deviceTimestamp || sensorReading.receivedAt)}</span>
                <span className="font-semibold text-emerald-700">{sensorReading.deviceId}</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="bg-emerald-50/60 p-1 rounded border border-emerald-100">
                  <span className="text-[8px] text-gray-400 block uppercase font-bold">Temp</span>
                  <span className="font-extrabold text-amber-700">{sensorReading.temperature}°C</span>
                </div>
                <div className="bg-emerald-50/60 p-1 rounded border border-emerald-100">
                  <span className="text-[8px] text-gray-400 block uppercase font-bold">Humidity</span>
                  <span className="font-extrabold text-blue-700">{sensorReading.humidity}%</span>
                </div>
                <div className="bg-emerald-50/60 p-1 rounded border border-emerald-100">
                  <span className="text-[8px] text-gray-400 block uppercase font-bold">Moisture</span>
                  <span className="font-extrabold text-teal-700">{sensorReading.moisture}%</span>
                </div>
              </div>

              {/* NPK Calibration Notice */}
              <div className="bg-amber-50/80 border border-amber-200/70 p-1.5 rounded text-[9px] text-amber-900 leading-snug">
                <span className="font-extrabold block text-amber-800">
                  ⚠️ {S.npkUncalibratedNotice || 'NPK Sensor Telemetry: Uncalibrated'}
                </span>
                {S.npkUncalibratedDesc || 'Raw sensor readings require lab probe calibration before model prediction. Enter calibrated N, P, K scores manually or use Manual Entry.'}
              </div>
            </div>
          )}

          {sensorNotice && (
            <p className="text-[9px] text-red-600">{sensorNotice}</p>
          )}
        </div>
      )}

      {/* Form Fields: District, Crop, Environmental, and NPK */}
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

      {/* Predict Button */}
      <button
        type="button"
        onClick={submitPredictionForm}
        disabled={
          loading ||
          !formValidation.complete ||
          (entryMode === 'sensor' && (!sensorStatus?.connected || !sensorReading))
        }
        className="w-full py-2 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        title={
          entryMode === 'sensor' && (!sensorStatus?.connected || !sensorReading)
            ? (S.noSensorMsg || 'No sensor device is connected. Connect an ESP32 device to receive live readings.')
            : formValidation.complete
            ? S.predict
            : Object.values(formErrors)[0] || S.predict
        }
      >
        🌱 {S.predict}
      </button>

      {showHints && !formValidation.complete && (
        <p className="text-[10px] text-red-600 font-semibold">
          {Object.values(formErrors)[0]}
        </p>
      )}

      {entryMode === 'sensor' && !sensorStatus?.connected && (
        <p className="text-[10px] text-amber-700 font-semibold text-center">
          ⚠️ {isTamilMode ? 'நேரடி சென்சார் அளவீடுகள் இல்லை. கைமுறை பதிவுக்கு மாறவும்.' : 'Live sensor data unavailable. Switch to Manual Entry to predict immediately.'}
        </p>
      )}
    </div>
  )
}

export default PredictionForm
