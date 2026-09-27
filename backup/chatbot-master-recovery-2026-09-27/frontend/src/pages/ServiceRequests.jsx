import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { PlusCircle, ClipboardList, CheckCircle2, XCircle, Clock, Send, AlertCircle, Eye, Check, RefreshCw } from 'lucide-react'

const ServiceRequests = () => {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Farmer specific states
  const [activeTab, setActiveTab] = useState('list') // 'list' or 'new'
  const [formData, setFormData] = useState({
    type: 'Fertilizer Request',
    description: '',
    quantity: ''
  })
  
  // Staff/Admin specific states
  const [filterStatus, setFilterStatus] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  
  const [error, setError] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState('')

  const requestTypes = [
    'Fertilizer Request',
    'Seed Request',
    'Soil Testing',
    'Equipment Rental',
    'Other Cooperative Service'
  ]

  useEffect(() => {
    fetchRequests()
  }, [filterStatus])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      setErrorMsg('')
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      const response = await axios.get(`/api/serviceRequests?${params}`)
      setRequests(response.data)
    } catch (err) {
      console.error('Failed to fetch requests:', err)
      setErrorMsg('Unable to load this information.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmitRequest = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    if (!formData.description.trim()) {
      setError('Description is required')
      return
    }

    try {
      const response = await axios.post('/api/serviceRequests', {
        type: formData.type,
        description: formData.description,
        quantity: formData.quantity || null
      })
      
      setSuccess('Service request submitted successfully!')
      setFormData({
        type: 'Fertilizer Request',
        description: '',
        quantity: ''
      })
      // Switch back to requests list tab
      setActiveTab('list')
      fetchRequests()
    } catch (err) {
      console.error('Error submitting request:', err)
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to submit service request')
    }
  }

  const handleUpdateStatus = async (requestId, nextStatus) => {
    setUpdatingId(requestId)
    setError('')
    setSuccess('')
    try {
      await axios.put(`/api/serviceRequests/${requestId}/status`, {
        status: nextStatus
      })
      setSuccess(`Request successfully marked as ${nextStatus}`)
      fetchRequests()
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || 'Failed to update request status')
    } finally {
      setUpdatingId(null)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        )
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approved
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        )
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
            <Check className="w-3 h-3 mr-1" />
            Completed
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-55 text-gray-700">
            {status}
          </span>
        )
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-gray-500 font-medium">Loading...</div>
  }

  if (errorMsg) {
    return (
      <div className="card bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center font-bold text-sm">
        {errorMsg}
      </div>
    )
  }

  const isFarmer = user?.role === 'FARMER'

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="page-header flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Requests Desk</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isFarmer ? 'Request fertilizers, seed stocks, soil tests, or equipment rental.' : 'Approve, reject, or track farmer service requests.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center text-sm">
          <AlertCircle className="w-4 h-4 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center text-sm">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          <span>{success}</span>
        </div>
      )}

      {/* FARMER INTERFACE */}
      {isFarmer && (
        <div className="space-y-4">
          <div className="flex space-x-2 border-b border-gray-100 pb-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center ${
                activeTab === 'list' 
                  ? 'bg-primary-600 text-white shadow-sm' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              My Requests
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center ${
                activeTab === 'new' 
                  ? 'bg-primary-600 text-white shadow-sm' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Request
            </button>
          </div>

          {/* New Request Creation Form */}
          {activeTab === 'new' && (
            <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm max-w-lg">
              <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Create New Cooperative Request</h3>
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Request Type</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  >
                    {requestTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Requested Quantity (Optional)</label>
                  <input
                    type="text"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    placeholder="e.g. 5 bags, 20 kg, 2 tractor hours"
                    className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Detailed Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe what you need and when (e.g. soil testing for paddy, urea fertilizer distribution)..."
                    className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                    rows="4"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full bg-primary-600 text-white font-bold py-2.5 rounded-xl hover:bg-primary-700 transition-colors shadow-sm flex items-center justify-center text-sm"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Request
                </button>
              </form>
            </div>
          )}

          {/* Farmer's Request History */}
          {activeTab === 'list' && (
            <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="py-4 px-6">Service Type</th>
                      <th className="py-4 px-6">Description</th>
                      <th className="py-4 px-6">Quantity</th>
                      <th className="py-4 px-6">Submitted Date</th>
                      <th className="py-4 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                    {requests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 font-bold text-gray-900">{req.type}</td>
                        <td className="py-4 px-6 max-w-xs truncate text-gray-500" title={req.description}>
                          {req.description}
                        </td>
                        <td className="py-4 px-6 font-medium text-gray-700">{req.quantity || 'N/A'}</td>
                        <td className="py-4 px-6 text-gray-500">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6">{getStatusBadge(req.status)}</td>
                      </tr>
                    ))}
                    {requests.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-gray-500 font-semibold text-sm">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STAFF / ADMIN INTERFACE */}
      {!isFarmer && (
        <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          {/* Status Filter */}
          <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-xl border border-gray-200 self-start text-xs max-w-md">
            <span className="font-bold text-gray-600">Filter Status:</span>
            {['', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  filterStatus === status 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {status || 'All'}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Farmer Name</th>
                  <th className="py-4 px-6">Service Type</th>
                  <th className="py-4 px-6">Description</th>
                  <th className="py-4 px-6">Quantity</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-bold text-gray-900 block">{req.farmer?.name}</span>
                      <span className="text-xs text-primary-600 font-semibold">{req.farmer?.membershipId} ({req.farmer?.village})</span>
                    </td>
                    <td className="py-4 px-6 font-bold text-gray-900">{req.type}</td>
                    <td className="py-4 px-6 max-w-xs text-gray-500 text-xs leading-relaxed" title={req.description}>
                      {req.description}
                    </td>
                    <td className="py-4 px-6 font-semibold text-gray-700">{req.quantity || 'N/A'}</td>
                    <td className="py-4 px-6 text-gray-500 text-xs">
                      {new Date(req.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6">{getStatusBadge(req.status)}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end space-x-1.5">
                        {req.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'APPROVED')}
                              disabled={updatingId === req.id}
                              className="px-2.5 py-1 text-xs font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors rounded-lg"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'REJECTED')}
                              disabled={updatingId === req.id}
                              className="px-2.5 py-1 text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors rounded-lg"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {req.status === 'APPROVED' && (
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'COMPLETED')}
                            disabled={updatingId === req.id}
                            className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors rounded-lg"
                          >
                            Complete
                          </button>
                        )}
                        {(req.status === 'COMPLETED' || req.status === 'REJECTED') && (
                          <span className="text-xs text-gray-400 font-medium">None</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-500 font-semibold text-sm">
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServiceRequests
