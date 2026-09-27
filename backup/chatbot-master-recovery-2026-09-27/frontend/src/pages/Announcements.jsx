import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { Plus, Edit, Trash2, Megaphone, Calendar } from 'lucide-react'

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const { user } = useAuth()

  const [formData, setFormData] = useState({
    title: '',
    content: ''
  })

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      setErrorMsg('')
      const response = await axios.get('/api/announcements')
      setAnnouncements(response.data)
    } catch (error) {
      console.error('Failed to fetch announcements:', error)
      setErrorMsg('Unable to load this information.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingAnnouncement) {
        await axios.put(`/api/announcements/${editingAnnouncement.id}`, formData)
      } else {
        await axios.post('/api/announcements', formData)
      }
      setShowModal(false)
      setEditingAnnouncement(null)
      setFormData({ title: '', content: '' })
      fetchAnnouncements()
    } catch (error) {
      console.error('Failed to save announcement:', error)
      alert(error.response?.data?.error || 'Failed to save announcement')
    }
  }

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement)
    setFormData({
      title: announcement.title,
      content: announcement.content
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return
    
    try {
      await axios.delete(`/api/announcements/${id}`)
      fetchAnnouncements()
    } catch (error) {
      console.error('Failed to delete announcement:', error)
      alert('Failed to delete announcement')
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

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Announcements</h1>
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Create Announcement
          </button>
        )}
      </div>

      <div className="space-y-4">
        {announcements.map((announcement) => (
          <div key={announcement.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-start flex-1">
                <div className="p-3 bg-primary-100 rounded-lg mr-4">
                  <Megaphone className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
                  <div className="flex items-center text-sm text-gray-500 mt-2">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(announcement.createdAt).toLocaleString()}
                  </div>
                  <p className="text-gray-600 mt-3 whitespace-pre-wrap">{announcement.content}</p>
                </div>
              </div>
              {canEdit && (
                <div className="flex space-x-2 ml-4">
                  <button onClick={() => handleEdit(announcement)} className="text-blue-600 hover:text-blue-800">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(announcement.id)} className="text-red-600 hover:text-red-800">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {announcements.length === 0 && (
        <div className="text-center py-12 text-gray-500 font-semibold text-sm">
          No data available
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-xl font-bold mb-4">
              {editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="input-field"
                  rows="6"
                  required
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="flex-1 btn-primary">
                  {editingAnnouncement ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingAnnouncement(null) }}
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

export default Announcements
