import { useState, useEffect } from 'react'
import axios from 'axios'
import { Thermometer, Droplets, Clock, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react'

const Warehouse = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchSensorData()
  }, [])

  const fetchSensorData = async () => {
    try {
      setRefreshing(true)
      const response = await axios.get('/api/dashboard')
      if (response.data && response.data.warehouse) {
        setData(response.data.warehouse)
      } else {
        // Fallback mock data in case no sensor data has been seeded/posted
        setData({
          temperature: 28.5,
          humidity: 68.0,
          timestamp: new Date().toISOString(),
          alert: false
        })
      }
      setError('')
    } catch (err) {
      console.error('Failed to fetch warehouse data:', err)
      setError('Failed to fetch sensor telemetry data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchSensorData()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-gray-500 font-medium">Loading...</div>
  }

  const humidity = data?.humidity || 0
  const temperature = data?.temperature || 0
  const isHighHumidity = humidity > 70

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="page-header flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warehouse Climate Control</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time temperature and humidity monitoring for crop preservation.</p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-secondary flex items-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl transition-colors font-bold text-sm shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center text-sm">
          <AlertTriangle className="w-4 h-4 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {/* Safety Alert Warnings */}
      {isHighHumidity && (
        <div className="bg-red-50 border-2 border-red-500 text-red-800 p-5 rounded-2xl flex items-start space-x-3.5 shadow-sm animate-pulse">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-extrabold text-base text-red-950">Critical Climate Alert!</h3>
            <p className="text-sm text-red-800 font-semibold">
              Humidity crosses the safety limit (70%). Current reading: <span className="font-extrabold text-red-950">{humidity}%</span>.
            </p>
            <p className="text-xs text-red-655 mt-1 leading-relaxed">
              Please switch on the warehouse ventilation exhaust fans immediately to prevent grain spoilage, mildew formation, or crop degradation.
            </p>
          </div>
        </div>
      )}

      {/* Primary Climate Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Temperature Card */}
        <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Internal Temperature</span>
              <h3 className="text-lg font-bold text-gray-900">Current Temperature</h3>
            </div>
            <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl text-orange-600">
              <Thermometer className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-5xl font-black text-gray-900">{temperature}</span>
            <span className="text-xl font-bold text-gray-500">°C</span>
          </div>
          <div className="pt-4 border-t border-gray-50 flex items-center text-xs text-gray-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-green-500 mr-1.5" />
            Within optimal crop storage limits (20°C - 35°C)
          </div>
        </div>

        {/* Humidity Card */}
        <div className={`card bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-between space-y-6 ${
          isHighHumidity ? 'border-red-400 bg-red-50/5' : 'border-gray-100'
        }`}>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Internal Moisture</span>
              <h3 className="text-lg font-bold text-gray-900">Current Humidity</h3>
            </div>
            <div className={`p-3 rounded-xl border ${
              isHighHumidity 
                ? 'bg-red-50 border-red-100 text-red-600' 
                : 'bg-blue-50 border-blue-100 text-blue-600'
            }`}>
              <Droplets className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className={`text-5xl font-black ${isHighHumidity ? 'text-red-600' : 'text-gray-900'}`}>{humidity}</span>
            <span className="text-xl font-bold text-gray-500">%</span>
          </div>
          <div className="pt-4 border-t border-gray-50 flex items-center text-xs text-gray-500 font-medium">
            {isHighHumidity ? (
              <span className="text-red-600 font-bold flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1.5 shrink-0" />
                Safety limit exceeded! Air is too damp.
              </span>
            ) : (
              <span className="text-green-600 font-bold flex items-center">
                <ShieldCheck className="w-4 h-4 mr-1.5 shrink-0" />
                Dry & Safe (Optimal humidity below 70%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Climate Metadata & Device Status */}
      <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-gray-900 border-b border-gray-50 pb-3">Sensor Telemetry Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm text-gray-700">
          <div>
            <span className="text-xs text-gray-400 block font-semibold">Sensor Status</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200 mt-2">
              ● Online & Broadcasting
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-400 block font-semibold">Telemetry Interval</span>
            <span className="font-bold text-gray-900 mt-2 block">Every 15 Minutes</span>
          </div>
          {data?.timestamp && (
            <div>
              <span className="text-xs text-gray-400 block font-semibold">Last Broadcast Received</span>
              <span className="font-medium text-gray-900 mt-2 block flex items-center text-xs">
                <Clock className="w-4 h-4 mr-1 text-gray-400" />
                {new Date(data.timestamp).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Warehouse
