import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { 
  Sprout, Cpu, CheckCircle2, AlertTriangle, XCircle, 
  Thermometer, Droplets, Activity, RefreshCw, Send, HelpCircle, FileText 
} from 'lucide-react'
import { fetchSensorStatus, fetchLatestReading } from '../services/sensorService'

const SoilSuitability = () => {
  const { user } = useAuth()
  const [mode, setMode] = useState('manual') // 'manual' or 'iot'
  const [districts, setDistricts] = useState([])
  const [crops, setCrops] = useState([])
  const [loadingMeta, setLoadingMeta] = useState(true)

  // Manual Form State
  const [formData, setFormData] = useState({
    district: 'Salem',
    soilType: 'Red Soil',
    crop: 'groundnut',
    nitrogen: '45',
    phosphorus: '30',
    potassium: '40',
    temperature: '29',
    humidity: '70',
    moisture: '3.5'
  })

  // IoT Sensor State
  const [deviceId, setDeviceId] = useState('')
  const [sensorStatus, setSensorStatus] = useState(null)
  const [iotReading, setIotReading] = useState(null)
  const [fetchingIot, setFetchingIot] = useState(false)
  const [iotError, setIotError] = useState('')

  // Evaluation & Results State
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchMetadata()
  }, [])

  useEffect(() => {
    if (mode === 'iot') {
      fetchLatestIot()
      const timer = setInterval(() => {
        fetchLatestIot()
      }, 10000)
      return () => clearInterval(timer)
    }
  }, [mode, deviceId])

  const fetchMetadata = async () => {
    try {
      setLoadingMeta(true)
      const res = await axios.get('/api/soil/meta')
      if (res.data) {
        setDistricts(res.data.districts || [])
        setCrops(res.data.crops || [])
      }
    } catch (err) {
      console.error('Failed to load soil metadata:', err)
    } finally {
      setLoadingMeta(false)
    }
  }

  const fetchLatestIot = async () => {
    try {
      setFetchingIot(true)
      setIotError('')
      const targetDevice = deviceId ? deviceId.trim() : null
      const status = await fetchSensorStatus(targetDevice)
      setSensorStatus(status)

      if (status.connected) {
        const res = await fetchLatestReading(targetDevice)
        if (res && res.reading) {
          setIotReading(res.reading)
          setFormData(prev => ({
            ...prev,
            temperature: res.reading.temperature.toString(),
            humidity: res.reading.humidity.toString(),
            moisture: res.reading.moisture.toString()
          }))
          return
        }
      }

      setIotReading(null)
      if (status.status === 'Stale') {
        setIotError('Sensor readings are stale. Device may be offline or stopped transmitting.')
      } else {
        setIotError('No sensor device is connected. Connect an ESP32 device to receive live readings.')
      }
    } catch (err) {
      console.error('Failed to fetch IoT sensor reading:', err)
      setIotReading(null)
      setIotError('Could not retrieve telemetry from sensor service.')
    } finally {
      setFetchingIot(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleAnalyze = async (e) => {
    e?.preventDefault()
    try {
      setAnalyzing(true)
      setErrorMsg('')
      setResult(null)

      const payload = {
        district: formData.district,
        soilType: formData.soilType,
        crop: formData.crop,
        nitrogen: parseFloat(formData.nitrogen),
        phosphorus: parseFloat(formData.phosphorus),
        potassium: parseFloat(formData.potassium),
        temperature: parseFloat(formData.temperature),
        humidity: parseFloat(formData.humidity),
        moisture: parseFloat(formData.moisture)
      }

      const res = await axios.post('/api/soil/check', payload)
      if (res.data && res.data.success) {
        setResult(res.data)
      } else {
        setErrorMsg(res.data.error || 'Failed to analyze soil suitability.')
      }
    } catch (err) {
      console.error('Error analyzing soil:', err)
      setErrorMsg(err.response?.data?.error || 'Failed to analyze soil suitability.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center">
            <Sprout className="w-6 h-6 text-primary-600 mr-2.5" />
            Soil Suitability & IoT Telemetry
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Analyze soil parameters, NPK nutrients, and climate data against 792,000+ Tamil Nadu soil records.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
          <button
            onClick={() => setMode('manual')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center ${
              mode === 'manual'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Manual Soil Form
          </button>
          <button
            onClick={() => {
              setMode('iot')
              if (!iotReading) fetchLatestIot()
            }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center ${
              mode === 'iot'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 mr-1.5" />
            IoT Sensor Mode
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-semibold flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 text-red-500 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Main Grid: Form / Telemetry on Left, Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-6 space-y-6">
          {mode === 'iot' && (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-extrabold text-indigo-900">ESP32 / NPK Sensor Unit</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    sensorStatus?.connected
                      ? 'bg-emerald-100 text-emerald-800'
                      : sensorStatus?.status === 'Stale'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                      sensorStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                    }`} />
                    {sensorStatus?.connected
                      ? 'Connected'
                      : sensorStatus?.status === 'Stale'
                      ? 'Stale Readings'
                      : 'Not Connected'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fetchLatestIot}
                  disabled={fetchingIot}
                  className="text-xs bg-white text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 font-bold flex items-center shadow-2xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${fetchingIot ? 'animate-spin' : ''}`} />
                  Refresh Readings
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-gray-700">Device ID:</label>
                <input
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="e.g. soil-device-001 (or blank for active)"
                  className="input-field text-xs py-1 px-2.5 bg-white w-52"
                />
              </div>

              {iotReading && sensorStatus?.connected ? (
                <div className="space-y-3">
                  <div className="text-[11px] text-gray-500 font-medium">
                    Last valid reading: {new Date(iotReading.deviceTimestamp || iotReading.receivedAt).toLocaleTimeString()}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100">
                      <span className="text-gray-400 block text-[10px] font-bold uppercase">Temp</span>
                      <span className="text-sm font-extrabold text-amber-600">{iotReading.temperature}°C</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100">
                      <span className="text-gray-400 block text-[10px] font-bold uppercase">Humidity</span>
                      <span className="text-sm font-extrabold text-blue-600">{iotReading.humidity}%</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100">
                      <span className="text-gray-400 block text-[10px] font-bold uppercase">Moisture</span>
                      <span className="text-sm font-extrabold text-teal-600">{iotReading.moisture}%</span>
                    </div>
                  </div>

                  {/* NPK Sensor Status Note */}
                  <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-xs text-amber-900 leading-snug">
                    <span className="font-extrabold block text-amber-800 mb-0.5">
                      ⚠️ NPK Sensor Telemetry: Uncalibrated
                    </span>
                    Raw sensor nutrient readings require laboratory probe calibration before model prediction. Enter calibrated N, P, K scores manually in the form or use Manual Entry.
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-600 bg-white/80 p-3 rounded-xl border border-indigo-100 leading-relaxed text-center">
                  {iotError || 'No sensor device is connected. Connect an ESP32 device to receive live readings.'}
                </div>
              )}
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-base font-extrabold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              {mode === 'manual' ? 'Soil & Field Parameters' : 'Target Crop & Location'}
            </h2>

            <form onSubmit={handleAnalyze} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    District <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="district"
                    value={formData.district}
                    onChange={handleInputChange}
                    className="input-field text-xs py-2"
                    required
                  >
                    {districts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Target Crop <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="crop"
                    value={formData.crop}
                    onChange={handleInputChange}
                    className="input-field text-xs py-2 capitalize"
                    required
                  >
                    {crops.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Soil Type
                </label>
                <select
                  name="soilType"
                  value={formData.soilType}
                  onChange={handleInputChange}
                  className="input-field text-xs py-2"
                >
                  <option value="Red Soil">Red Soil</option>
                  <option value="Black Soil">Black Soil</option>
                  <option value="Alluvial Soil">Alluvial Soil</option>
                  <option value="Clay Loam">Clay Loam</option>
                  <option value="Sandy Loam">Sandy Loam</option>
                  <option value="Laterite Soil">Laterite Soil</option>
                </select>
              </div>

              <div className="pt-2">
                <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-2">
                  Soil Nutrients (NPK)
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Nitrogen (N)</label>
                    <input
                      type="number"
                      name="nitrogen"
                      value={formData.nitrogen}
                      onChange={handleInputChange}
                      className="input-field text-xs py-2"
                      placeholder="mg/kg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Phosphorus (P)</label>
                    <input
                      type="number"
                      name="phosphorus"
                      value={formData.phosphorus}
                      onChange={handleInputChange}
                      className="input-field text-xs py-2"
                      placeholder="mg/kg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Potassium (K)</label>
                    <input
                      type="number"
                      name="potassium"
                      value={formData.potassium}
                      onChange={handleInputChange}
                      className="input-field text-xs py-2"
                      placeholder="mg/kg"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-2">
                  Environmental Telemetry
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Temp (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      name="temperature"
                      value={formData.temperature}
                      onChange={handleInputChange}
                      className="input-field text-xs py-2"
                      placeholder="°C"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Humidity (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      name="humidity"
                      value={formData.humidity}
                      onChange={handleInputChange}
                      className="input-field text-xs py-2"
                      placeholder="%"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Moisture (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      name="moisture"
                      value={formData.moisture}
                      onChange={handleInputChange}
                      className="input-field text-xs py-2"
                      placeholder="%"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={analyzing || (mode === 'iot' && (!sensorStatus?.connected || !iotReading))}
                  title={
                    mode === 'iot' && (!sensorStatus?.connected || !iotReading)
                      ? 'No sensor device is connected. Connect an ESP32 device to receive live readings.'
                      : 'Run Suitability Analysis'
                  }
                  className="w-full btn-primary py-3 flex items-center justify-center font-bold text-sm bg-primary-600 hover:bg-primary-700 rounded-xl text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sprout className="w-4 h-4 mr-2" />
                  {analyzing ? 'Evaluating Soil Dataset...' : 'Run Suitability Analysis'}
                </button>
                {mode === 'iot' && (!sensorStatus?.connected || !iotReading) && (
                  <p className="text-xs text-amber-600 font-semibold text-center mt-2">
                    ⚠️ No live sensor connected. Switch to "Manual Soil Form" to analyze immediately.
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Analysis Results Card */}
        <div className="lg:col-span-6 space-y-6">
          {result ? (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5 animate-fade-in">
              {/* Header Badge */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">CatBoost ML Prediction</span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                      Model: {result.modelUsed || 'CatBoostClassifier'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 capitalize mt-0.5">
                    {result.crop} in {result.district}
                  </h3>
                  <div className="flex items-center space-x-2 text-xs text-gray-500 font-medium">
                    <span>Soil Type: {result.soilType}</span>
                    {result.confidence && (
                      <span className="text-gray-400">• Confidence: {Math.round(result.confidence * 100)}%</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-primary-700">
                    {result.scores.overallSuitabilityScore}<span className="text-xs text-gray-400">/100</span>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    result.classification === 'Suitable'
                      ? 'bg-green-100 text-green-800'
                      : result.classification === 'Needs Improvement'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.statusEmoji} {result.classification}
                  </span>
                </div>
              </div>

              {/* Parameter Score Bars */}
              <div>
                <span className="text-xs font-extrabold text-gray-700 block mb-2.5">Parameter Score Breakdown</span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between text-gray-600 font-semibold">
                      <span>Nitrogen (N)</span>
                      <span>{Math.round(result.scores.nitrogenScore * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-primary-600 h-full rounded-full" style={{ width: `${result.scores.nitrogenScore * 100}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-gray-600 font-semibold">
                      <span>Phosphorus (P)</span>
                      <span>{Math.round(result.scores.phosphorusScore * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-primary-600 h-full rounded-full" style={{ width: `${result.scores.phosphorusScore * 100}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-gray-600 font-semibold">
                      <span>Potassium (K)</span>
                      <span>{Math.round(result.scores.potassiumScore * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-primary-600 h-full rounded-full" style={{ width: `${result.scores.potassiumScore * 100}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-gray-600 font-semibold">
                      <span>Temperature</span>
                      <span>{Math.round(result.scores.temperatureScore * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: `${result.scores.temperatureScore * 100}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-gray-600 font-semibold">
                      <span>Humidity</span>
                      <span>{Math.round(result.scores.humidityScore * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${result.scores.humidityScore * 100}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-gray-600 font-semibold">
                      <span>Moisture</span>
                      <span>{Math.round(result.scores.moistureScore * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-teal-500 h-full rounded-full" style={{ width: `${result.scores.moistureScore * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strengths & Improvements */}
              <div className="space-y-3 pt-2">
                {result.strengths && result.strengths.length > 0 && (
                  <div className="bg-green-50/70 border border-green-200/80 p-3.5 rounded-xl">
                    <span className="text-xs font-bold text-green-900 flex items-center mb-1.5">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mr-1.5 shrink-0" />
                      Key Strengths
                    </span>
                    <ul className="text-xs text-green-800 space-y-1 pl-5 list-disc">
                      {result.strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.improvements && result.improvements.length > 0 && (
                  <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl">
                    <span className="text-xs font-bold text-amber-900 flex items-center mb-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mr-1.5 shrink-0" />
                      Areas for Improvement
                    </span>
                    <ul className="text-xs text-amber-800 space-y-1 pl-5 list-disc">
                      {result.improvements.map((imp, idx) => (
                        <li key={idx}>{imp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Agricultural Recommendation Card */}
              <div className="bg-primary-50/70 border border-primary-200/70 p-4 rounded-xl">
                <span className="text-xs font-extrabold text-primary-900 block mb-1">
                  🌱 Cooperative Advisory Recommendation:
                </span>
                <p className="text-xs text-primary-800 leading-relaxed">
                  {result.recommendation}
                </p>
              </div>

              {/* Dataset Reference Specs */}
              {result.cropRequirements && (
                <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-xl text-xs text-gray-600">
                  <span className="font-bold text-gray-800 block mb-1">Crop Scientific Requirements:</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>• Optimal Temp: <b>{result.cropRequirements.minTemp}–{result.cropRequirements.maxTemp}°C</b></div>
                    <div>• Optimal Humidity: <b>{result.cropRequirements.minHumidity}–{result.cropRequirements.maxHumidity}%</b></div>
                    <div>• Water Requirement: <b>{result.cropRequirements.waterReq}</b></div>
                    <div>• pH Tolerance: <b>{result.cropRequirements.minPh}–{result.cropRequirements.maxPh}</b></div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center flex flex-col items-center justify-center h-full min-h-[380px]">
              <div className="w-16 h-16 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
                <Sprout className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-gray-800 mb-1">
                Ready for Soil Analysis
              </h3>
              <p className="text-xs text-gray-500 max-w-sm">
                Enter your soil nutrients and environmental parameters on the left or sync from an IoT sensor device to receive an instant suitability evaluation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SoilSuitability
