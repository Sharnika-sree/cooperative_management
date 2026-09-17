import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { Plus, Edit, Trash2, CheckCircle, Calendar, FileText, Award } from 'lucide-react'

const Schemes = () => {
  const [schemes, setSchemes] = useState([])
  const [eligibleSchemes, setEligibleSchemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingScheme, setEditingScheme] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const { user } = useAuth()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eligibilityRules: '',
    requiredDocuments: '',
    deadline: '',
    benefits: ''
  })

  useEffect(() => {
    fetchSchemes()
    if (user?.role === 'FARMER') {
      fetchEligibleSchemes()
    }
  }, [user])

  const fetchSchemes = async () => {
    try {
      setErrorMsg('')
      const response = await axios.get('/api/schemes')
      setSchemes(response.data)
    } catch (error) {
      console.error('Failed to fetch schemes:', error)
      setErrorMsg('Unable to load this information.')
    } finally {
      setLoading(false)
    }
  }

  const fetchEligibleSchemes = async () => {
    try {
      if (!user || !user.id) return
      const farmer = await axios.get('/api/farmers').then(res => 
        res.data.find(f => f.userId === user.id)
      )
      if (farmer) {
        const response = await axios.get(`/api/schemes/eligible/${farmer.id}`)
        setEligibleSchemes(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch eligible schemes:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      let parsedRules = {}
      try {
        parsedRules = typeof formData.eligibilityRules === 'string'
          ? JSON.parse(formData.eligibilityRules)
          : formData.eligibilityRules
      } catch (err) {
        alert('Invalid JSON format for Eligibility Rules')
        return
      }

      const payload = {
        ...formData,
        eligibilityRules: parsedRules,
        requiredDocuments: formData.requiredDocuments.split(',').map(d => d.trim()).filter(Boolean),
        deadline: new Date(formData.deadline).toISOString()
      }

      if (editingScheme) {
        await axios.put(`/api/schemes/${editingScheme.id}`, payload)
      } else {
        await axios.post('/api/schemes', payload)
      }
      setShowModal(false)
      setEditingScheme(null)
      setFormData({
        title: '',
        description: '',
        eligibilityRules: '',
        requiredDocuments: '',
        deadline: '',
        benefits: ''
      })
      fetchSchemes()
    } catch (error) {
      console.error('Failed to save scheme:', error)
      alert(error.response?.data?.error || 'Failed to save scheme')
    }
  }

  const handleEdit = (scheme) => {
    setEditingScheme(scheme)
    let rulesString = ''
    try {
      if (typeof scheme.eligibilityRules === 'string') {
        rulesString = JSON.stringify(JSON.parse(scheme.eligibilityRules), null, 2)
      } else if (typeof scheme.eligibilityRules === 'object') {
        rulesString = JSON.stringify(scheme.eligibilityRules, null, 2)
      }
    } catch (e) {
      rulesString = scheme.eligibilityRules || ''
    }

    const docsString = Array.isArray(scheme.requiredDocuments)
      ? scheme.requiredDocuments.join(', ')
      : (scheme.requiredDocuments || '')

    setFormData({
      title: scheme.title || '',
      description: scheme.description || '',
      eligibilityRules: rulesString,
      requiredDocuments: docsString,
      deadline: scheme.deadline ? scheme.deadline.split('T')[0] : '',
      benefits: scheme.benefits || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this scheme?')) return
    
    try {
      await axios.delete(`/api/schemes/${id}`)
      fetchSchemes()
    } catch (error) {
      console.error('Failed to delete scheme:', error)
      alert('Failed to delete scheme')
    }
  }

  const canEdit = user?.role === 'ADMIN'

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

  const displaySchemes = user?.role === 'FARMER' ? eligibleSchemes : schemes

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          {user?.role === 'FARMER' ? 'Eligible Schemes' : 'Government Schemes'}
        </h1>
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Add Scheme
          </button>
        )}
      </div>

      {user?.role === 'FARMER' && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
          <p className="text-primary-800">
            Showing {eligibleSchemes.length} schemes you are eligible for based on your profile.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displaySchemes.map((scheme) => (
          <div key={scheme.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Award className="w-5 h-5 text-purple-600" />
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold">{scheme.title}</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </span>
                </div>
              </div>
              {canEdit && (
                <div className="flex space-x-2">
                  <button onClick={() => handleEdit(scheme)} className="text-blue-600 hover:text-blue-800">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(scheme.id)} className="text-red-600 hover:text-red-800">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <p className="text-gray-600 text-sm mb-4 line-clamp-3">{scheme.description}</p>

            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-600">Deadline: </span>
                <span className="ml-1 font-medium">{new Date(scheme.deadline).toLocaleDateString()}</span>
              </div>

              <div className="flex items-start text-sm">
                <FileText className="w-4 h-4 mr-2 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-gray-600">Required Documents: </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(Array.isArray(scheme.requiredDocuments)
                      ? scheme.requiredDocuments
                      : typeof scheme.requiredDocuments === 'string'
                        ? scheme.requiredDocuments.split(',').map(d => d.trim()).filter(Boolean)
                        : []
                    ).map((doc, idx) => (
                      <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {doc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  <span className="font-semibold">Benefits:</span> {scheme.benefits}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {displaySchemes.length === 0 && (
        <div className="text-center py-12 text-gray-500 font-semibold text-sm">
          No data available
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 my-8">
            <h2 className="text-xl font-bold mb-4">
              {editingScheme ? 'Edit Scheme' : 'Add Scheme'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows="3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Eligibility Rules (JSON)
                </label>
                <textarea
                  value={formData.eligibilityRules}
                  onChange={(e) => setFormData({ ...formData, eligibilityRules: e.target.value })}
                  className="input-field font-mono text-sm"
                  rows="4"
                  placeholder='{"minLandSize": 2, "maxLandSize": 10, "requiredCrops": ["wheat", "rice"]}'
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Example: {`{"minLandSize": 2, "maxLandSize": 10, "requiredCrops": ["wheat", "rice"]}`}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Required Documents (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.requiredDocuments}
                  onChange={(e) => setFormData({ ...formData, requiredDocuments: e.target.value })}
                  className="input-field"
                  placeholder="Aadhar Card, Land Documents, Income Certificate"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Benefits</label>
                <textarea
                  value={formData.benefits}
                  onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                  className="input-field"
                  rows="2"
                  required
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="flex-1 btn-primary">
                  {editingScheme ? 'Update' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingScheme(null) }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Schemes
