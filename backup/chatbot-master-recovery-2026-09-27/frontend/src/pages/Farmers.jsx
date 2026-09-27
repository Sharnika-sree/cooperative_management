import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { Search, Plus, Edit, Trash2, Filter, AlertTriangle, ShieldAlert, ChevronRight, ChevronLeft, CheckCircle2, User, MapPin, Sprout, Check } from 'lucide-react'

const Farmers = () => {
  const [farmers, setFarmers] = useState([])
  const [unregisteredUsers, setUnregisteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingFarmer, setEditingFarmer] = useState(null)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterVillage, setFilterVillage] = useState('')
  const [filterCrop, setFilterCrop] = useState('')
  const { user } = useAuth()

  // Wizard Steps: 1 - Personal, 2 - Address, 3 - Farming, 4 - Confirm
  const [step, setStep] = useState(1)
  const [userSelectionType, setUserSelectionType] = useState('existing') // 'existing' or 'new'
  
  const predefinedCrops = ['Paddy', 'Wheat', 'Turmeric', 'Cotton', 'Sugarcane', 'Vegetables']
  const [selectedCrops, setSelectedCrops] = useState([])
  const [otherCrop, setOtherCrop] = useState('')
  const [hasOtherCrop, setHasOtherCrop] = useState(false)

  const [formData, setFormData] = useState({
    userId: '',
    membershipId: '',
    name: '',
    age: '',
    gender: 'Male',
    mobileNumber: '',
    village: '',
    district: '',
    address: '',
    landSize: '',
    landUnit: 'Acres',
    farmingType: 'Small Farmer',
    irrigationType: 'Borewell',
    email: '',
    password: ''
  })
  
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchFarmers()
  }, [])

  const fetchFarmers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (filterVillage) params.append('village', filterVillage)
      if (filterCrop) params.append('crop', filterCrop)

      const response = await axios.get(`/api/farmers?${params}`)
      setFarmers(response.data)
    } catch (error) {
      console.error('Failed to fetch farmers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFarmers()
  }, [searchTerm, filterVillage, filterCrop])

  const fetchUnregisteredUsers = async () => {
    try {
      const response = await axios.get('/api/farmers/unregistered-users')
      setUnregisteredUsers(response.data)
      if (response.data.length > 0) {
        setFormData(prev => ({ ...prev, userId: response.data[0].id }))
      } else {
        setUserSelectionType('new')
      }
    } catch (err) {
      console.error('Failed to fetch unregistered users:', err)
    }
  }

  const handleOpenAddModal = () => {
    setEditingFarmer(null)
    setFormData({
      userId: '',
      membershipId: `MEM${Math.floor(100000 + Math.random() * 900000)}`,
      name: '',
      age: '',
      gender: 'Male',
      mobileNumber: '',
      village: '',
      district: 'Erode',
      address: '',
      landSize: '',
      landUnit: 'Acres',
      farmingType: 'Small Farmer',
      irrigationType: 'Borewell',
      email: '',
      password: ''
    })
    setSelectedCrops([])
    setOtherCrop('')
    setHasOtherCrop(false)
    setUserSelectionType('existing')
    setError('')
    setStep(1)
    setShowModal(true)
    fetchUnregisteredUsers()
  }

  const nextStep = () => {
    // Basic validations per step
    if (step === 1) {
      if (!formData.name || !formData.mobileNumber) {
        setError('Please fill in Name and Mobile Number')
        return
      }
      if (!editingFarmer && userSelectionType === 'new') {
        if (!formData.email || !formData.password) {
          setError('Email and Password are required for new login creation')
          return
        }
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters')
          return
        }
      }
    }
    if (step === 2) {
      if (!formData.village || !formData.district) {
        setError('Please fill in Village and District')
        return
      }
    }
    if (step === 3) {
      if (!formData.landSize || isNaN(parseFloat(formData.landSize))) {
        setError('Please enter a valid Land Size')
        return
      }
      if (selectedCrops.length === 0 && (!hasOtherCrop || !otherCrop.trim())) {
        setError('Please select or specify at least one crop')
        return
      }
    }
    setError('')
    setStep(prev => prev + 1)
  }

  const prevStep = () => {
    setError('')
    setStep(prev => prev - 1)
  }

  const handleCropCheckboxChange = (cropName) => {
    if (selectedCrops.includes(cropName)) {
      setSelectedCrops(selectedCrops.filter(c => c !== cropName))
    } else {
      setSelectedCrops([...selectedCrops, cropName])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      let finalUserId = formData.userId

      // If creating a new user credentials account inline
      if (!editingFarmer && userSelectionType === 'new') {
        const userRes = await axios.post('/api/auth/register', {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: 'FARMER'
        })
        finalUserId = userRes.data.user.id
      }

      // Collect crops list
      let cropsPayload = [...selectedCrops]
      if (hasOtherCrop && otherCrop.trim()) {
        cropsPayload.push(otherCrop.trim())
      }

      const farmerPayload = {
        userId: finalUserId,
        membershipId: formData.membershipId,
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender,
        mobileNumber: formData.mobileNumber,
        village: formData.village,
        district: formData.district,
        address: formData.address,
        landSize: parseFloat(formData.landSize),
        landUnit: formData.landUnit,
        farmingType: formData.farmingType,
        irrigationType: formData.irrigationType,
        crops: cropsPayload
      }

      if (editingFarmer) {
        await axios.put(`/api/farmers/${editingFarmer.id}`, farmerPayload)
      } else {
        await axios.post('/api/farmers', farmerPayload)
      }
      setShowModal(false)
      fetchFarmers()
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to save farmer profile')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (farmer) => {
    setEditingFarmer(farmer)
    
    // Parse crop values to populate checkboxes
    const cropNames = farmer.crops ? farmer.crops.map(c => c.name) : []
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

    setFormData({
      userId: farmer.userId,
      membershipId: farmer.membershipId,
      name: farmer.name,
      age: farmer.age ? farmer.age.toString() : '',
      gender: farmer.gender || 'Male',
      mobileNumber: farmer.mobileNumber,
      village: farmer.village,
      district: farmer.district || 'Erode',
      address: farmer.address || '',
      landSize: farmer.landSize.toString(),
      landUnit: farmer.landUnit || 'Acres',
      farmingType: farmer.farmingType || 'Small Farmer',
      irrigationType: farmer.irrigationType || 'Borewell',
      email: '',
      password: ''
    })
    
    setError('')
    setUserSelectionType('existing')
    setStep(1)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to remove this farmer?')) return
    setError('')
    setSuccess('')
    try {
      await axios.delete(`/api/farmers/${id}`)
      setSuccess('Farmer deleted successfully.')
      setFarmers(farmers.filter(f => f.id !== id))
    } catch (error) {
      console.error(error)
      setError(error.response?.data?.error || 'Failed to delete farmer profile')
    }
  }

  const isStaff = user?.role === 'STAFF'
  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN'

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Farmers Directory</h1>
          <p className="text-sm text-gray-500 mt-1">
          {isStaffOrAdmin ? 'Register new members using the step-by-step wizard, or edit profiles.' : 'View all registered cooperative members.'}
          </p>
        </div>
        {isStaffOrAdmin && (
          <button onClick={handleOpenAddModal} className="btn-primary flex items-center bg-primary-600 text-white px-4 py-2.5 rounded-xl hover:bg-primary-700 transition-colors shadow-sm font-semibold">
            <Plus className="w-4 h-4 mr-2" />
            Register Farmer
          </button>
        )}
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center text-sm shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center text-sm shadow-sm animate-fade-in">
          <AlertTriangle className="w-4 h-4 mr-2" />
          <span>{error}</span>
        </div>
      )}

      <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
        {/* Search filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, ID, mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full border border-gray-200 rounded-xl py-2 outline-none focus:border-primary-500 text-sm"
            />
          </div>
          <input
            type="text"
            placeholder="Filter by village"
            value={filterVillage}
            onChange={(e) => setFilterVillage(e.target.value)}
            className="input-field w-full border border-gray-200 rounded-xl py-2 outline-none focus:border-primary-500 text-sm"
          />
          <input
            type="text"
            placeholder="Filter by crop"
            value={filterCrop}
            onChange={(e) => setFilterCrop(e.target.value)}
            className="input-field w-full border border-gray-200 rounded-xl py-2 outline-none focus:border-primary-500 text-sm"
          />
          <button
            onClick={() => { setSearchTerm(''); setFilterVillage(''); setFilterCrop('') }}
            className="btn-secondary flex items-center justify-center border border-gray-200 bg-gray-50 hover:bg-gray-100 py-2 rounded-xl transition-colors font-semibold text-sm"
          >
            <Filter className="w-4 h-4 mr-2 text-gray-500" />
            Clear Filters
          </button>
        </div>

        {/* Farmers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-4 px-6">ID / Name</th>
                <th className="py-4 px-6">Age / Gender</th>
                <th className="py-4 px-6">Contact & Village</th>
                <th className="py-4 px-6">Land Details</th>
                <th className="py-4 px-6">Crops Cultivated</th>
                <th className="py-4 px-6">Farming & Irrigation</th>
                {isStaff && <th className="py-4 px-6 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {farmers.map((farmer) => (
                <tr key={farmer.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-6">
                    <span className="font-semibold text-primary-600 block text-xs">{farmer.membershipId}</span>
                    <span className="font-bold text-gray-900">{farmer.name}</span>
                  </td>
                  <td className="py-4 px-6 text-gray-500">
                    {farmer.age ? `${farmer.age} yrs` : 'N/A'} • {farmer.gender || 'N/A'}
                  </td>
                  <td className="py-4 px-6 text-gray-500">
                    <span className="block text-gray-900">{farmer.mobileNumber}</span>
                    <span className="text-xs text-gray-400">{farmer.village}, {farmer.district || 'Erode'}</span>
                  </td>
                  <td className="py-4 px-6 font-medium text-gray-700">
                    {farmer.landSize} {farmer.landUnit || 'Acres'}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1">
                      {farmer.crops && farmer.crops.length > 0 ? (
                        farmer.crops.map((c, idx) => (
                          <span key={idx} className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            {c.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs">No Crops</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-xs text-gray-500">
                    <span className="block font-medium text-gray-700">{farmer.farmingType || 'N/A'}</span>
                    <span className="text-gray-400">{farmer.irrigationType || 'N/A'}</span>
                  </td>
                  {isStaffOrAdmin && (
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end space-x-2">
                        <button onClick={() => handleEdit(farmer)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(farmer.id)} className="p-2 text-red-650 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {farmers.length === 0 && (
                <tr>
                  <td colSpan={isStaffOrAdmin ? 7 : 6} className="py-12 text-center text-gray-400 text-sm">
                    No farmer records found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4-Step Registration Wizard Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
              <h2 className="text-xl font-bold flex items-center">
                <Plus className="w-5 h-5 mr-2" />
                {editingFarmer ? 'Edit Farmer Profile' : 'Farmer Registration Wizard'}
              </h2>
              {/* Wizard Steps Indicator */}
              <div className="flex items-center space-x-2 mt-4">
                {[
                  { stepNum: 1, label: 'Personal', icon: User },
                  { stepNum: 2, label: 'Address', icon: MapPin },
                  { stepNum: 3, label: 'Farming', icon: Sprout },
                  { stepNum: 4, label: 'Confirm', icon: Check }
                ].map((s) => {
                  const StepIcon = s.icon
                  const isCurrent = step === s.stepNum
                  const isCompleted = step > s.stepNum
                  return (
                    <div key={s.stepNum} className="flex items-center flex-1">
                      <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                        isCurrent ? 'bg-white text-primary-700 scale-110 shadow-md' : 
                        isCompleted ? 'bg-primary-200 text-primary-800' : 'bg-primary-800/40 text-primary-200'
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-4 h-4 text-primary-800" /> : s.stepNum}
                      </div>
                      <span className={`text-xs ml-1.5 hidden sm:inline ${isCurrent ? 'font-bold text-white' : 'text-primary-200'}`}>{s.label}</span>
                      {s.stepNum < 4 && <div className={`flex-1 h-0.5 mx-2 bg-primary-800/40 ${step > s.stepNum ? 'bg-primary-300' : ''}`} />}
                    </div>
                  )
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start text-xs font-medium">
                  <ShieldAlert className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* STEP 1: Personal Details */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Step 1: Personal Details</h3>
                  
                  {/* Account binding for new farmer profiles */}
                  {!editingFarmer && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Cooperative Login Association</span>
                      <div className="flex space-x-4">
                        <label className="flex items-center text-xs text-gray-700 font-semibold cursor-pointer">
                          <input 
                            type="radio" 
                            name="userSelectionType" 
                            value="existing"
                            checked={userSelectionType === 'existing'}
                            onChange={() => setUserSelectionType('existing')}
                            className="mr-1.5 focus:ring-primary-500 text-primary-600"
                            disabled={unregisteredUsers.length === 0}
                          />
                          Existing Login User
                        </label>
                        <label className="flex items-center text-xs text-gray-700 font-semibold cursor-pointer">
                          <input 
                            type="radio" 
                            name="userSelectionType" 
                            value="new"
                            checked={userSelectionType === 'new'}
                            onChange={() => setUserSelectionType('new')}
                            className="mr-1.5 focus:ring-primary-500 text-primary-600"
                          />
                          Create New Credentials
                        </label>
                      </div>

                      {userSelectionType === 'existing' ? (
                        <div className="mt-1">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Select User Profile</label>
                          <select
                            value={formData.userId}
                            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                            className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                          >
                            {unregisteredUsers.map((u) => (
                              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-0.5">Email Address</label>
                            <input
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                              placeholder="ravi@coop.com"
                              required={userSelectionType === 'new'}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-0.5">Password</label>
                            <input
                              type="password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className="input-field w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                              placeholder="Min 6 characters"
                              required={userSelectionType === 'new'}
                              minLength="6"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                        placeholder="Ravi Kumar"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Coop Membership ID</label>
                      <input
                        type="text"
                        value={formData.membershipId}
                        onChange={(e) => setFormData({ ...formData, membershipId: e.target.value })}
                        className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 font-semibold"
                        required
                        readOnly={!!editingFarmer}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Age</label>
                      <input
                        type="number"
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                        className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                        placeholder="e.g. 42"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number</label>
                    <input
                      type="text"
                      value={formData.mobileNumber}
                      onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                      className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                      placeholder="9876543210"
                      required
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Address Details */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Step 2: Address & Location</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Village</label>
                      <input
                        type="text"
                        value={formData.village}
                        onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                        className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                        placeholder="e.g. Erode"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">District</label>
                      <input
                        type="text"
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                        placeholder="e.g. Erode"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Full Physical Address</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                      placeholder="Street name, landmark..."
                      rows="3"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: Farming Details */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Step 3: Sowing & Land Details</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Land Area</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.landSize}
                        onChange={(e) => setFormData({ ...formData, landSize: e.target.value })}
                        className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                        placeholder="e.g. 2.5"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Land Unit</label>
                      <select
                        value={formData.landUnit}
                        onChange={(e) => setFormData({ ...formData, landUnit: e.target.value })}
                        className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                      >
                        <option value="Acres">Acres</option>
                        <option value="Hectares">Hectares</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Irrigation Type</label>
                      <select
                        value={formData.irrigationType}
                        onChange={(e) => setFormData({ ...formData, irrigationType: e.target.value })}
                        className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                      >
                        <option value="Borewell">Borewell</option>
                        <option value="Drip">Drip Irrigation</option>
                        <option value="Canal">Canal</option>
                        <option value="Rainfed">Rainfed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Farming Type</label>
                      <select
                        value={formData.farmingType}
                        onChange={(e) => setFormData({ ...formData, farmingType: e.target.value })}
                        className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                      >
                        <option value="Small Farmer">Small Farmer (&lt; 2.5 acres)</option>
                        <option value="Medium Farmer">Medium Farmer (2.5 - 5 acres)</option>
                        <option value="Large Farmer">Large Farmer (&gt; 5 acres)</option>
                      </select>
                    </div>
                  </div>

                  {/* Crops selection checkboxes */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-700">Crops Cultivated (Select all that apply)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                      {predefinedCrops.map((cropName) => (
                        <label key={cropName} className="flex items-center text-xs text-gray-700 cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={selectedCrops.includes(cropName)}
                            onChange={() => handleCropCheckboxChange(cropName)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                          />
                          {cropName}
                        </label>
                      ))}
                      <label className="flex items-center text-xs text-gray-700 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={hasOtherCrop}
                          onChange={(e) => setHasOtherCrop(e.target.checked)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                        />
                        Other Crop
                      </label>
                    </div>

                    {hasOtherCrop && (
                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Specify Other Crop(s) (comma-separated)</label>
                        <input
                          type="text"
                          value={otherCrop}
                          onChange={(e) => setOtherCrop(e.target.value)}
                          className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                          placeholder="e.g. Groundnut, Maize"
                          required={hasOtherCrop}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: Confirm Details */}
              {step === 4 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Step 4: Confirm Registration Profile</h3>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3.5 text-xs text-gray-700">
                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 border-b border-gray-250/60 pb-3">
                      <div>
                        <span className="text-gray-400 block font-semibold">Farmer Full Name</span>
                        <span className="font-extrabold text-sm text-gray-900">{formData.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Membership ID</span>
                        <span className="font-extrabold text-sm text-gray-900">{formData.membershipId}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Mobile Number</span>
                        <span className="font-bold text-gray-800">{formData.mobileNumber}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Age & Gender</span>
                        <span className="font-bold text-gray-800">{formData.age ? `${formData.age} Yrs` : 'N/A'} • {formData.gender}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 border-b border-gray-250/60 pb-3">
                      <div>
                        <span className="text-gray-400 block font-semibold">Village</span>
                        <span className="font-bold text-gray-800">{formData.village}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">District</span>
                        <span className="font-bold text-gray-800">{formData.district}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400 block font-semibold">Physical Address</span>
                        <span className="font-bold text-gray-800">{formData.address || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                      <div>
                        <span className="text-gray-400 block font-semibold">Land Size & Unit</span>
                        <span className="font-extrabold text-gray-900">{formData.landSize} {formData.landUnit}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Irrigation & Farming Type</span>
                        <span className="font-bold text-gray-800">{formData.irrigationType} • {formData.farmingType}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400 block font-semibold">Crops Selected</span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {selectedCrops.map((c, idx) => (
                            <span key={idx} className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">
                              {c}
                            </span>
                          ))}
                          {hasOtherCrop && otherCrop.trim() && (
                            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">
                              {otherCrop.trim()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom buttons panel */}
              <div className="flex space-x-3 pt-6 border-t border-gray-150">
                {step > 1 && (
                  <button 
                    type="button" 
                    onClick={prevStep}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors flex items-center justify-center text-sm"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-50 border hover:bg-gray-100 text-gray-500 font-bold rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                {step < 4 ? (
                  <button 
                    type="button" 
                    onClick={nextStep}
                    className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center text-sm shadow-sm"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                ) : (
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center text-sm shadow-sm"
                  >
                    {submitting ? 'Registering...' : editingFarmer ? 'Save Profile' : 'Register Farmer'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Farmers
