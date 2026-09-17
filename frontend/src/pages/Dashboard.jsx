import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { 
  Users, UserCheck, Package, FileText, Activity, AlertTriangle, 
  Thermometer, Droplets, Clock, Megaphone, CheckCircle2, 
  HelpCircle, ChevronRight, User, Award, ListFilter, ClipboardList, Send, Edit, X, ShieldAlert 
} from 'lucide-react'
import Chatbot from '../components/Chatbot'

// Centralized UI Labels for localization (e.g., Tamil support later)
const uiLabels = {
  profile: "👤 My Profile",
  profileSub: "View / Edit Details",
  crops: "🌾 My Crops",
  schemes: "📋 Government Schemes",
  fertilizer: "📦 Fertilizer",
  fertilizerSub: "Check Availability",
  requests: "📋 My Requests",
  requestsSub: "Track & Submit requests",
  assistant: "🤖 Ask Assistant",
  assistantSub: "Get Help",
  age: "Age",
  village: "Village",
  land: "Land Size",
  irrigation: "Irrigation",
  farmingType: "Farming Type",
  save: "Save Changes",
  editProfile: "Edit Profile Information",
  schemesCount: "schemes available",
  requestsCount: "requests submitted",
  available: "Check Availability"
};

const Dashboard = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  // Farmer edit profile state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({
    name: '',
    age: '',
    mobileNumber: '',
    address: '',
    village: '',
    district: '',
    landSize: '',
    landUnit: 'Acres',
    farmingType: 'Small Farmer',
    irrigationType: 'Borewell',
    crops: []
  })
  
  const predefinedCrops = ['Paddy', 'Wheat', 'Turmeric', 'Cotton', 'Sugarcane', 'Vegetables']
  const [selectedCrops, setSelectedCrops] = useState([])
  const [otherCrop, setOtherCrop] = useState('')
  const [hasOtherCrop, setHasOtherCrop] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  
  // Navigation states for farmer clicking simple cards
  const [showProfileInfo, setShowProfileInfo] = useState(false)
  const [showCropsInfo, setShowCropsInfo] = useState(false)
  const [showSchemesInfo, setShowSchemesInfo] = useState(false)
  const [showFertilizerInfo, setShowFertilizerInfo] = useState(false)
  const [showRequestsInfo, setShowRequestsInfo] = useState(false)
  const [showChatbotWindow, setShowChatbotWindow] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/dashboard')
      setData(response.data)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenEditModal = () => {
    const profile = data?.farmerProfile
    if (!profile) return

    setEditFormData({
      name: profile.name || '',
      age: profile.age ? profile.age.toString() : '',
      mobileNumber: profile.mobileNumber || '',
      address: profile.address || '',
      village: profile.village || '',
      district: profile.district || '',
      landSize: profile.landSize ? profile.landSize.toString() : '',
      landUnit: profile.landUnit || 'Acres',
      farmingType: profile.farmingType || 'Small Farmer',
      irrigationType: profile.irrigationType || 'Borewell'
    })

    const cropNames = profile.crops || []
    const predefinedSelected = cropNames.filter(c => predefinedCrops.includes(c))
    const customSelected = cropNames.filter(c => !predefinedCrops.includes(c))

    setSelectedCrops(predefinedSelected)
    if (customSelected.length > 0) {
      setHasOtherCrop(true)
      setOtherCrop(customSelected.join(', '))
    } else {
      setHasOtherCrop(false)
      setOtherCrop('')
    }
    
    setEditError('')
    setShowEditModal(true)
  }

  const handleCropCheckboxChange = (cropName) => {
    if (selectedCrops.includes(cropName)) {
      setSelectedCrops(selectedCrops.filter(c => c !== cropName))
    } else {
      setSelectedCrops([...selectedCrops, cropName])
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      let cropsPayload = [...selectedCrops]
      if (hasOtherCrop && otherCrop.trim()) {
        cropsPayload.push(otherCrop.trim())
      }

      const payload = {
        name: editFormData.name,
        age: editFormData.age ? parseInt(editFormData.age) : null,
        mobileNumber: editFormData.mobileNumber,
        address: editFormData.address,
        village: editFormData.village,
        district: editFormData.district,
        landSize: parseFloat(editFormData.landSize),
        landUnit: editFormData.landUnit,
        farmingType: editFormData.farmingType,
        irrigationType: editFormData.irrigationType,
        crops: cropsPayload
      }

      await axios.put(`/api/farmers/${data.farmerProfile.id}`, payload)
      setShowEditModal(false)
      fetchDashboardData()
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to save changes. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading dashboard...</div>
  }

  const isHighHumidity = data?.warehouse?.humidity > 70

  // 1. ADMIN DASHBOARD VIEW
  if (user?.role === 'ADMIN') {
    const adminStats = [
      { name: 'Total Farmers', value: data?.totalFarmers || 0, icon: Users, color: 'text-blue-600 bg-blue-50 border-blue-100' },
      { name: 'Cooperative Staff', value: data?.totalStaff || 0, icon: UserCheck, color: 'text-green-600 bg-green-50 border-green-100' },
      { name: 'Active Schemes', value: data?.activeSchemes || 0, icon: FileText, color: 'text-purple-600 bg-purple-50 border-purple-100' },
      { name: 'Pending Service Requests', value: data?.pendingServiceRequests || 0, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-100' },
    ]

    return (
      <div className="space-y-6">
        <div className="page-header bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Admin dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Society analytics, service requests distribution, and warehouse climate IoT telemetry.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {adminStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.name} className="card bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-500">{stat.name}</p>
                  <p className="text-3xl font-extrabold text-gray-950 mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl border ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center border-b border-gray-100 pb-3">
              <Activity className="w-5 h-5 mr-2 text-primary-500" />
              Inventory Usage Report
            </h3>
            {data?.charts?.inventoryUsage && data.charts.inventoryUsage.length > 0 ? (
              <div className="space-y-4">
                {data.charts.inventoryUsage.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-gray-700">{item.name}</span>
                      <span className="text-gray-950 font-bold">{item.totalQuantity} Distributed</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-primary-600 h-full rounded-full" style={{ width: `${Math.min(100, (item.totalQuantity / 400) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm py-8 text-center">No distributions logged yet.</p>
            )}
          </div>

          <div className={`card bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-between ${isHighHumidity ? 'border-red-500 bg-red-50/10' : 'border-gray-100'}`}>
            <div>
              <h3 className="text-lg font-bold text-gray-950 border-b border-gray-50 pb-3 flex items-center">
                <Thermometer className="w-5 h-5 mr-2 text-orange-500" />
                Warehouse Monitoring
              </h3>
              {data?.warehouse ? (
                <div className="space-y-6 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium text-sm">Temperature</span>
                    <span className="text-xl font-bold text-gray-950">{data.warehouse.temperature}°C</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium text-sm">Humidity</span>
                    <span className={`text-xl font-bold ${isHighHumidity ? 'text-red-600' : 'text-blue-600'}`}>{data.warehouse.humidity}%</span>
                  </div>
                  {isHighHumidity && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-start leading-relaxed">
                      <AlertTriangle className="w-4 h-4 mr-2 shrink-0 mt-0.5 animate-bounce" />
                      <div>
                        <p className="font-bold">Ventilation Warning!</p>
                        Humidity has crossed the 70% safety threshold.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm mt-4">No sensor readings logged.</p>
              )}
            </div>
            {data?.warehouse?.timestamp && (
              <p className="text-xs text-gray-400 mt-4 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1" />
                Last updated: {new Date(data.warehouse.timestamp).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <Chatbot />
      </div>
    )
  }

  // 2. STAFF DASHBOARD VIEW
  if (user?.role === 'STAFF') {
    const staffStats = [
      { name: "Today's Farmer Registrations", value: data?.todayFarmers || 0, icon: Users, color: 'text-blue-600 bg-blue-50 border-blue-100' },
      { name: 'Inventory Items Configured', value: data?.inventoryAvailable || 0, icon: Package, color: 'text-purple-600 bg-purple-50 border-purple-100' },
      { name: 'Pending Fertilizer/Seed Dist', value: data?.pendingDistributions || 0, icon: ListFilter, color: 'text-amber-600 bg-amber-50 border-amber-100' },
      { name: 'Total Pending Service Requests', value: data?.pendingServiceRequests || 0, icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-100' },
    ]

    return (
      <div className="space-y-6">
        <div className="page-header bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Staff Operations Desk</h1>
          <p className="text-sm text-gray-500 mt-1">Manage farmers registration details, service requests, and inventory distributions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {staffStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.name} className="card bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-500">{stat.name}</p>
                  <p className="text-3xl font-extrabold text-gray-950 mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl border ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <h4 className="font-bold text-gray-900">Farmers Management</h4>
            <p className="text-xs text-gray-500 leading-relaxed">Register new farmers through the wizard. Log land details, gender, age, and irrigation types to verify cooperative benefits.</p>
          </div>
          <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <h4 className="font-bold text-gray-900">Distribution Queue</h4>
            <p className="text-xs text-gray-500 leading-relaxed">Fulfill Urea or Paddy Seeds requests and decrement available stock volumes directly using the inventory logs.</p>
          </div>
          <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <h4 className="font-bold text-gray-900">Service Requests</h4>
            <p className="text-xs text-gray-500 leading-relaxed">Check, approve, or reject soil testing and tractor rental service requests submitted online by cooperative members.</p>
          </div>
        </div>
      </div>
    )
  }

  // 3. FARMER DASHBOARD VIEW (ULTRA SIMPLE)
  if (user?.role === 'FARMER') {
    const profile = data?.farmerProfile

    return (
      <div className="space-y-6">
        {/* Simple Welcome Header */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Vanakkam, {profile?.name || user.name}!</h1>
            <p className="text-gray-500 text-sm mt-1">Cooperative Member Portal</p>
          </div>
          {profile && (
            <div className="text-xs bg-gray-50 border p-3 rounded-xl font-mono text-gray-500">
              <span className="block font-bold text-primary-700">Member ID: {profile.membershipId}</span>
              <span>Reg: {profile.registrationDate ? new Date(profile.registrationDate).toLocaleDateString() : 'N/A'}</span>
            </div>
          )}
        </div>

        {/* Simple Warehouse Status Section */}
        <div className={`p-5 rounded-2xl border bg-white shadow-sm space-y-3.5 ${
          data?.warehouse?.alert ? 'border-amber-400 bg-amber-50/5 animate-pulse' : 'border-gray-100'
        }`}>
          <div className="flex justify-between items-center border-b pb-2 border-gray-100">
            <h3 className="font-extrabold text-gray-900 text-sm flex items-center">
              🏢 Warehouse Status
            </h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
              data?.warehouse?.alert ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
            }`}>
              {data?.warehouse?.alert ? '⚠ Storage Warning' : '✓ Storage Status: Normal'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2.5">
              <span className="text-2xl">🌡</span>
              <div>
                <span className="text-[10px] text-gray-400 block font-semibold">Temperature</span>
                <span className="font-black text-gray-800 text-sm">
                  {data?.warehouse?.temperature !== undefined ? `${data.warehouse.temperature}°C` : '29°C'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2.5">
              <span className="text-2xl">💧</span>
              <div>
                <span className="text-[10px] text-gray-400 block font-semibold">Humidity</span>
                <span className="font-black text-gray-800 text-sm">
                  {data?.warehouse?.humidity !== undefined ? `${data.warehouse.humidity}%` : '68%'}
                </span>
              </div>
            </div>
          </div>

          {data?.warehouse?.alert && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-xl text-xs font-semibold leading-normal flex items-start">
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-600 shrink-0 mt-0.5" />
              <span>Humidity is high. Please check warehouse ventilation.</span>
            </div>
          )}

          <div className="text-[10px] text-gray-450 font-medium flex items-center pt-0.5">
            <Clock className="w-3.5 h-3.5 mr-1" />
            Last Updated: {data?.warehouse?.timestamp ? new Date(data.warehouse.timestamp).toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
            }) : '10 Aug 2026, 10:30 AM'}
          </div>
        </div>

        {/* 6 Large Simple Navigation Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: My Profile */}
          <button 
            onClick={() => { setShowProfileInfo(!showProfileInfo); setShowCropsInfo(false); setShowSchemesInfo(false); setShowFertilizerInfo(false); setShowRequestsInfo(false); }}
            className={`p-6 rounded-2xl border text-left flex items-start justify-between transition-all ${
              showProfileInfo ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-500/10' : 'bg-white border-gray-100 hover:shadow-md'
            }`}
          >
            <div className="space-y-2.5">
              <span className="text-2xl block">{uiLabels.profile}</span>
              <p className="text-sm font-bold text-gray-500">{uiLabels.profileSub}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
          </button>

          {/* Card 2: My Crops */}
          <button 
            onClick={() => { setShowCropsInfo(!showCropsInfo); setShowProfileInfo(false); setShowSchemesInfo(false); setShowFertilizerInfo(false); setShowRequestsInfo(false); }}
            className={`p-6 rounded-2xl border text-left flex items-start justify-between transition-all ${
              showCropsInfo ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-500/10' : 'bg-white border-gray-100 hover:shadow-md'
            }`}
          >
            <div className="space-y-2.5">
              <span className="text-2xl block">{uiLabels.crops}</span>
              <p className="text-sm font-bold text-gray-500">
                {profile?.crops && profile.crops.length > 0 ? profile.crops.join(' • ') : 'No Crops'}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
          </button>

          {/* Card 3: Government Schemes */}
          <button 
            onClick={() => { setShowSchemesInfo(!showSchemesInfo); setShowProfileInfo(false); setShowCropsInfo(false); setShowFertilizerInfo(false); setShowRequestsInfo(false); }}
            className={`p-6 rounded-2xl border text-left flex items-start justify-between transition-all ${
              showSchemesInfo ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-500/10' : 'bg-white border-gray-100 hover:shadow-md'
            }`}
          >
            <div className="space-y-2.5">
              <span className="text-2xl block">{uiLabels.schemes}</span>
              <p className="text-sm font-bold text-primary-700">
                {data?.eligibleSchemesCount || 0} {uiLabels.schemesCount}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
          </button>

          {/* Card 4: Fertilizer Stocks */}
          <button 
            onClick={() => { setShowFertilizerInfo(!showFertilizerInfo); setShowProfileInfo(false); setShowCropsInfo(false); setShowSchemesInfo(false); setShowRequestsInfo(false); }}
            className={`p-6 rounded-2xl border text-left flex items-start justify-between transition-all ${
              showFertilizerInfo ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-500/10' : 'bg-white border-gray-100 hover:shadow-md'
            }`}
          >
            <div className="space-y-2.5">
              <span className="text-2xl block">{uiLabels.fertilizer}</span>
              <p className="text-sm font-bold text-gray-500">{uiLabels.fertilizerSub}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
          </button>

          {/* Card 5: My Requests */}
          <button 
            onClick={() => { setShowRequestsInfo(!showRequestsInfo); setShowProfileInfo(false); setShowCropsInfo(false); setShowSchemesInfo(false); setShowFertilizerInfo(false); }}
            className={`p-6 rounded-2xl border text-left flex items-start justify-between transition-all ${
              showRequestsInfo ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-500/10' : 'bg-white border-gray-100 hover:shadow-md'
            }`}
          >
            <div className="space-y-2.5">
              <span className="text-2xl block">{uiLabels.requests}</span>
              <p className="text-sm font-bold text-gray-500">{uiLabels.requestsSub}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
          </button>

          {/* Card 6: Chatbot Assistant */}
          <button 
            onClick={() => setShowChatbotWindow(!showChatbotWindow)}
            className={`p-6 rounded-2xl border text-left flex items-start justify-between transition-all ${
              showChatbotWindow ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-500/10' : 'bg-white border-gray-100 hover:shadow-md'
            }`}
          >
            <div className="space-y-2.5">
              <span className="text-2xl block">{uiLabels.assistant}</span>
              <p className="text-sm font-bold text-gray-500">{uiLabels.assistantSub}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
          </button>
        </div>

        {/* Dynamic Display Sections below the Grid Cards */}
        <div className="space-y-6">
          {/* My Profile Information Display */}
          {showProfileInfo && (
            <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 animate-slide-up">
              <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                <h3 className="text-lg font-bold text-gray-900">👤 {uiLabels.profile}</h3>
                <button 
                  onClick={handleOpenEditModal}
                  className="flex items-center text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 mr-1" />
                  Edit Profile Info
                </button>
              </div>

              {profile ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm text-gray-700">
                  <div>
                    <span className="text-xs text-gray-400 block font-semibold">Full Name</span>
                    <span className="font-extrabold text-base text-gray-950 mt-1 block">{profile.name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-semibold">{uiLabels.age}</span>
                    <span className="font-bold text-gray-900 mt-1 block">{profile.age ? `${profile.age} Years` : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-semibold">Gender</span>
                    <span className="font-bold text-gray-900 mt-1 block">{profile.gender || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-semibold">Contact Mobile</span>
                    <span className="font-bold text-gray-900 mt-1 block">{profile.mobileNumber}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-semibold">{uiLabels.village}</span>
                    <span className="font-bold text-gray-900 mt-1 block">{profile.village}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-semibold">District</span>
                    <span className="font-bold text-gray-900 mt-1 block">{profile.district || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-semibold">{uiLabels.land}</span>
                    <span className="font-bold text-gray-900 mt-1 block">{profile.landSize} {profile.landUnit || 'Acres'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-semibold">{uiLabels.irrigation}</span>
                    <span className="font-bold text-gray-900 mt-1 block">{profile.irrigationType || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-semibold">{uiLabels.farmingType}</span>
                    <span className="font-bold text-gray-900 mt-1 block">{profile.farmingType || 'N/A'}</span>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <span className="text-xs text-gray-400 block font-semibold">Physical Address</span>
                    <span className="font-bold text-gray-900 mt-1 block">{profile.address || 'N/A'}</span>
                  </div>
                </div>
              ) : (
                <p className="text-amber-700 text-xs bg-amber-50 p-4 border border-amber-200 rounded-xl leading-relaxed">
                  Profile not linked. Please register with Staff to populate your profile.
                </p>
              )}
            </div>
          )}

          {/* My Crops Sowing Display */}
          {showCropsInfo && (
            <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 animate-slide-up">
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-50 pb-3">🌾 {uiLabels.crops}</h3>
              <div className="flex flex-wrap gap-3">
                {profile?.crops && profile.crops.length > 0 ? (
                  profile.crops.map((c, idx) => (
                    <div key={idx} className="bg-green-50 border border-green-150 text-green-800 px-5 py-3 rounded-2xl flex items-center space-x-2 font-bold text-base shadow-sm">
                      <span className="text-xl">🌾</span>
                      <span>{c}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm">No crops cultivated yet. Edit profile to configure crops.</p>
                )}
              </div>
            </div>
          )}

          {/* Government Schemes Eligibility Display */}
          {showSchemesInfo && (
            <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 animate-slide-up">
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-50 pb-3">📋 Government Benefit Schemes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data?.eligibleSchemes?.map((scheme) => (
                  <div 
                    key={scheme.id} 
                    className={`p-5 rounded-2xl border flex flex-col justify-between space-y-3 shadow-sm ${
                      scheme.isEligible ? 'bg-green-50/40 border-green-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-extrabold text-gray-900 text-base">{scheme.title}</h4>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                          scheme.isEligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {scheme.isEligible ? 'Eligible' : 'Not Eligible'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed">{scheme.description}</p>
                    </div>
                    <div className="pt-2 border-t border-gray-200/50 flex justify-between text-xs items-center">
                      <span className="text-gray-400 font-medium">Status Check:</span>
                      <span className={`font-semibold ${scheme.isEligible ? 'text-green-700' : 'text-red-700'}`}>
                        {scheme.reason}
                      </span>
                    </div>
                  </div>
                ))}
                {(!data?.eligibleSchemes || data.eligibleSchemes.length === 0) && (
                  <p className="text-gray-450 text-sm">No active schemes found.</p>
                )}
              </div>
            </div>
          )}

          {/* Fertilizer Stock check */}
          {showFertilizerInfo && (
            <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 animate-slide-up">
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-50 pb-3">📦 Fertilizer & Seed Availability</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {data?.availableFertilizers?.map((item, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between shadow-sm">
                    <div>
                      <span className="text-xs text-gray-400 font-bold block uppercase">Warehouse Stock</span>
                      <span className="font-extrabold text-gray-800 mt-0.5 block">{item.name}</span>
                    </div>
                    <span className={`text-sm font-extrabold px-3 py-1 rounded-lg ${
                      item.quantity > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {item.quantity > 0 ? `${item.quantity} ${item.unit}` : 'Out of Stock'}
                    </span>
                  </div>
                ))}
                {(!data?.availableFertilizers || data.availableFertilizers.length === 0) && (
                  <p className="text-gray-450 text-sm">No inventory stocks loaded.</p>
                )}
              </div>
            </div>
          )}

          {/* Service Requests submission & history log shortcut */}
          {showRequestsInfo && (
            <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 animate-slide-up">
              <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                <h3 className="text-lg font-bold text-gray-900">📋 Service Request Shortcuts</h3>
                <Link to="/service-requests" className="text-xs font-bold text-primary-600 bg-primary-50 px-3.5 py-2 rounded-lg hover:bg-primary-100 transition-colors">
                  Go to Service Requests Page →
                </Link>
              </div>
              <p className="text-sm text-gray-500">You can submit crop testing, tractor rentals, or seed requests online. Check your request approvals directly on the dedicated requests page.</p>
            </div>
          )}
        </div>

        {/* Latest Announcements */}
        <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-gray-950 flex items-center border-b border-gray-50 pb-3">
            <Megaphone className="w-5 h-5 mr-2 text-primary-500" />
            Latest Announcements & Advisories
          </h3>
          {data?.recentAnnouncements?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.recentAnnouncements.map((ann) => (
                <div key={ann.id} className="p-4 bg-gray-50 border border-gray-150 rounded-xl space-y-1.5 shadow-sm">
                  <h4 className="font-extrabold text-gray-900 text-sm">{ann.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{ann.content}</p>
                  <span className="text-[10px] text-gray-400 block pt-1.5">{new Date(ann.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No announcements posted by cooperative managers.</p>
          )}
        </div>

        {/* AI Chatbot Assistant floating popup if enabled */}
        {showChatbotWindow && (
          <div className="fixed bottom-6 right-6 z-50">
            <Chatbot />
          </div>
        )}
        
        {/* Fallback floating button if chatbot isn't checked as card but they want it */}
        {!showChatbotWindow && <Chatbot />}

        {/* EDIT PROFILE MODAL */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col max-h-[85vh]">
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-5 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-lg font-bold flex items-center">
                    <Edit className="w-5 h-5 mr-2" />
                    {uiLabels.editProfile}
                  </h2>
                  <p className="text-xs text-primary-100">Update your details to sync with database record</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="hover:bg-primary-800 p-1.5 rounded-lg text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
                {editError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start text-xs font-semibold">
                    <ShieldAlert className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                    <span>{editError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={editFormData.age}
                      onChange={(e) => setEditFormData({ ...editFormData, age: e.target.value })}
                      className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number</label>
                    <input
                      type="text"
                      value={editFormData.mobileNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, mobileNumber: e.target.value })}
                      className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Village</label>
                    <input
                      type="text"
                      value={editFormData.village}
                      onChange={(e) => setEditFormData({ ...editFormData, village: e.target.value })}
                      className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">District</label>
                    <input
                      type="text"
                      value={editFormData.district}
                      onChange={(e) => setEditFormData({ ...editFormData, district: e.target.value })}
                      className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Address</label>
                  <textarea
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                    rows="2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Land Size</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editFormData.landSize}
                      onChange={(e) => setEditFormData({ ...editFormData, landSize: e.target.value })}
                      className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Land Unit</label>
                    <select
                      value={editFormData.landUnit}
                      onChange={(e) => setEditFormData({ ...editFormData, landUnit: e.target.value })}
                      className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                    >
                      <option value="Acres">Acres</option>
                      <option value="Hectares">Hectares</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Irrigation Type</label>
                    <select
                      value={editFormData.irrigationType}
                      onChange={(e) => setEditFormData({ ...editFormData, irrigationType: e.target.value })}
                      className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                    >
                      <option value="Borewell">Borewell</option>
                      <option value="Drip">Drip</option>
                      <option value="Canal">Canal</option>
                      <option value="Rainfed">Rainfed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Farming Type</label>
                    <select
                      value={editFormData.farmingType}
                      onChange={(e) => setEditFormData({ ...editFormData, farmingType: e.target.value })}
                      className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                    >
                      <option value="Small Farmer">Small Farmer</option>
                      <option value="Medium Farmer">Medium Farmer</option>
                      <option value="Large Farmer">Large Farmer</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700">Crops Cultivated</label>
                  <div className="grid grid-cols-2 gap-1.5 bg-gray-50 p-3 rounded-lg border text-xs">
                    {predefinedCrops.map((c) => (
                      <label key={c} className="flex items-center cursor-pointer font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedCrops.includes(c)}
                          onChange={() => handleCropCheckboxChange(c)}
                          className="rounded text-primary-600 focus:ring-primary-500 mr-2"
                        />
                        {c}
                      </label>
                    ))}
                    <label className="flex items-center cursor-pointer font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={hasOtherCrop}
                        onChange={(e) => setHasOtherCrop(e.target.checked)}
                        className="rounded text-primary-600 focus:ring-primary-500 mr-2"
                      />
                      Other Crop
                    </label>
                  </div>
                  {hasOtherCrop && (
                    <input
                      type="text"
                      value={otherCrop}
                      onChange={(e) => setOtherCrop(e.target.value)}
                      className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs mt-1"
                      placeholder="e.g. Groundnut"
                      required={hasOtherCrop}
                    />
                  )}
                </div>

                <div className="flex space-x-3 pt-4 border-t border-gray-150">
                  <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={editSaving} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm">
                    {editSaving ? 'Saving...' : uiLabels.save}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}

export default Dashboard
