import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Edit, Trash2, UserPlus, Mail, ShieldAlert } from 'lucide-react'

const StaffManagement = () => {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      setErrorMsg('')
      const response = await axios.get('/api/staff')
      setStaff(response.data)
    } catch (err) {
      console.error('Failed to fetch staff:', err)
      setErrorMsg('Unable to load this information.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (editingStaff) {
        // Edit existing staff (password is optional)
        const payload = { name: formData.name, email: formData.email }
        if (formData.password) payload.password = formData.password
        await axios.put(`/api/staff/${editingStaff.id}`, payload)
      } else {
        // Add new staff
        if (!formData.password) {
          setError('Password is required for new staff')
          return
        }
        await axios.post('/api/staff', formData)
      }
      setShowModal(false)
      setEditingStaff(null)
      setFormData({ name: '', email: '', password: '' })
      fetchStaff()
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Operation failed')
    }
  }

  const handleEdit = (user) => {
    setEditingStaff(user)
    setFormData({ name: user.name, email: user.email, password: '' })
    setError('')
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this staff account?')) return
    try {
      await axios.delete(`/api/staff/${id}`)
      fetchStaff()
    } catch (err) {
      alert('Failed to delete staff account')
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

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage cooperative staff accounts, permissions, and profiles.</p>
        </div>
        <button onClick={() => { setEditingStaff(null); setFormData({ name: '', email: '', password: '' }); setError(''); setShowModal(true) }} className="btn-primary flex items-center bg-primary-600 text-white px-4 py-2 rounded-xl hover:bg-primary-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Staff Account
        </button>
      </div>

      <div className="card overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm">
        {staff.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Created At</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {staff.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 font-medium text-gray-900 flex items-center">
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold mr-3">
                        {user.name.charAt(0)}
                      </div>
                      {user.name}
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-1 text-gray-400" />
                        {user.email}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="bg-primary-50 text-primary-700 text-xs px-2.5 py-1 rounded-full font-medium">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end space-x-2">
                        <button onClick={() => handleEdit(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(user.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <UserPlus className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-semibold text-gray-700">No data available</p>
            <p className="text-sm text-gray-400 mt-1">Create staff accounts to delegate daily operations.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all duration-300 scale-100 border border-gray-100">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
              <h2 className="text-xl font-bold flex items-center">
                <UserPlus className="w-5 h-5 mr-2" />
                {editingStaff ? 'Edit Staff Account' : 'Create Staff Account'}
              </h2>
              <p className="text-xs text-primary-100 mt-1">Provide credentials and details for the staff member.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start text-sm">
                  <ShieldAlert className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  placeholder="e.g. Priya"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  placeholder="e.g. priya@coop.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password {editingStaff && <span className="text-gray-400 text-xs font-normal">(Leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  placeholder={editingStaff ? '••••••••' : 'At least 6 characters'}
                  required={!editingStaff}
                  minLength="6"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors shadow-sm">
                  {editingStaff ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffManagement
