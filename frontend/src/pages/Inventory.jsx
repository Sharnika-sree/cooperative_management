import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { Plus, Package, ClipboardList, Send, AlertTriangle, CheckCircle2, ChevronRight, History } from 'lucide-react'

const Inventory = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('stock') // 'stock', 'distribute', 'history'
  const [inventory, setInventory] = useState([])
  const [farmers, setFarmers] = useState([])
  const [distributions, setDistributions] = useState([])
  const [loading, setLoading] = useState(true)

  // Log Distribution Form State
  const [distFormData, setDistFormData] = useState({
    farmerId: '',
    inventoryId: '',
    quantity: ''
  })
  
  // Stock Adjustment Form State (STAFF/ADMIN only)
  const [showAddStockModal, setShowAddStockModal] = useState(false)
  const [stockFormData, setStockFormData] = useState({
    name: '',
    type: 'FERTILIZER',
    quantity: '',
    unit: 'Bags',
    minStock: ''
  })

  const [error, setError] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [showUpdateStockModal, setShowUpdateStockModal] = useState(false)
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null)
  const [updateFormData, setUpdateFormData] = useState({
    amount: '',
    action: 'ADD',
    name: '',
    type: 'FERTILIZER',
    unit: 'Bags',
    minStock: ''
  })

  useEffect(() => {
    fetchInventory()
    fetchDistributions()
    if (user?.role === 'STAFF' || user?.role === 'ADMIN') {
      fetchFarmers()
    }
  }, [])

  const fetchInventory = async () => {
    try {
      setLoading(true)
      setErrorMsg('')
      const response = await axios.get('/api/inventory')
      const invList = response.data.inventory || []
      setInventory(invList)
      if (invList.length > 0 && !distFormData.inventoryId) {
        setDistFormData(prev => ({ ...prev, inventoryId: invList[0].id }))
      }
    } catch (err) {
      console.error('Failed to load inventory:', err)
      setErrorMsg('Unable to load this information.')
    } finally {
      setLoading(false)
    }
  }

  const fetchFarmers = async () => {
    try {
      const response = await axios.get('/api/farmers')
      setFarmers(response.data)
      if (response.data.length > 0 && !distFormData.farmerId) {
        setDistFormData(prev => ({ ...prev, farmerId: response.data[0].id }))
      }
    } catch (err) {
      console.error('Failed to load farmers list:', err)
    }
  }

  const fetchDistributions = async () => {
    try {
      const response = await axios.get('/api/distributions')
      setDistributions(response.data)
    } catch (err) {
      console.error('Failed to load distributions history:', err)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setDistFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmitDistribution = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    const selectedItem = inventory.find(i => i.id === distFormData.inventoryId)
    const quantityNum = parseFloat(distFormData.quantity)

    // Form validation
    if (!distFormData.farmerId) {
      setError('Please select a farmer')
      setSubmitting(false)
      return
    }
    if (!distFormData.inventoryId) {
      setError('Please select an item')
      setSubmitting(false)
      return
    }
    if (isNaN(quantityNum) || quantityNum <= 0) {
      setError('Quantity must be a positive number')
      setSubmitting(false)
      return
    }
    if (selectedItem && selectedItem.quantity < quantityNum) {
      setError(`Insufficient stock. Only ${selectedItem.quantity} ${selectedItem.unit} available.`)
      setSubmitting(false)
      return
    }

    try {
      await axios.post('/api/distributions', {
        farmerId: distFormData.farmerId,
        inventoryId: distFormData.inventoryId,
        quantity: quantityNum
      })

      setSuccess('Distribution logged successfully! Stock quantity decremented.')
      setDistFormData(prev => ({ ...prev, quantity: '' }))
      
      // Update data lists
      await fetchInventory()
      await fetchDistributions()
      setActiveTab('history')
    } catch (err) {
      console.error('Error logging distribution:', err)
      setError(err.response?.data?.error || 'Failed to submit distribution')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddStockSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      const payload = {
        name: stockFormData.name,
        type: stockFormData.type,
        quantity: parseFloat(stockFormData.quantity),
        unit: stockFormData.unit,
        minStock: parseFloat(stockFormData.minStock)
      }

      await axios.post('/api/inventory', payload)
      setSuccess('Inventory item added successfully!')
      setShowAddStockModal(false)
      fetchInventory()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add inventory item')
    }
  }

  const handleOpenUpdateModal = (item) => {
    setSelectedInventoryItem(item)
    setUpdateFormData({
      amount: '',
      action: 'ADD',
      name: item.name,
      type: item.type,
      unit: item.unit,
      minStock: item.minStock.toString()
    })
    setError('')
    setSuccess('')
    setShowUpdateStockModal(true)
  }

  const handleUpdateStockSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    const qtyNum = parseFloat(updateFormData.amount)
    if (qtyNum !== undefined && (isNaN(qtyNum) || qtyNum <= 0)) {
      setError('Adjustment quantity must be a positive number')
      setSubmitting(false)
      return
    }

    if (!updateFormData.name.trim()) {
      setError('Item name cannot be empty')
      setSubmitting(false)
      return
    }

    if (!updateFormData.unit.trim()) {
      setError('Unit cannot be empty')
      setSubmitting(false)
      return
    }

    if (updateFormData.action === 'REDUCE' && selectedInventoryItem.quantity < qtyNum) {
      setError('Insufficient stock available.')
      setSubmitting(false)
      return
    }

    try {
      const payload = {
        action: updateFormData.action,
        quantity: qtyNum,
        name: updateFormData.name,
        type: updateFormData.type,
        unit: updateFormData.unit,
        minStock: parseFloat(updateFormData.minStock)
      }

      await axios.patch(`/api/inventory/${selectedInventoryItem.id}`, payload)
      setSuccess('Stock updated successfully.')
      setShowUpdateStockModal(false)
      fetchInventory()
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || 'Failed to update stock')
    } finally {
      setSubmitting(false)
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

  const isStaff = user?.role === 'STAFF'
  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN'

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory & Distributions</h1>
          <p className="text-sm text-gray-500 mt-1">Society seed/fertilizer stock tracking and distribution log book.</p>
        </div>
        {isStaffOrAdmin && (
          <button 
            onClick={() => {
              setStockFormData({ name: '', type: 'FERTILIZER', quantity: '', unit: 'Bags', minStock: '' })
              setShowAddStockModal(true)
            }}
            className="btn-primary flex items-center bg-primary-600 text-white px-4 py-2 rounded-xl hover:bg-primary-700 transition-colors shadow-sm font-semibold text-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Inventory Item
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center text-sm">
          <AlertTriangle className="w-4 h-4 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center text-sm">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs panels */}
      <div className="flex space-x-2 border-b border-gray-100 pb-2">
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center ${
            activeTab === 'stock' 
              ? 'bg-primary-600 text-white shadow-sm' 
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Package className="w-4 h-4 mr-2" />
          Stock Levels
        </button>
        
        {isStaff && (
          <button
            onClick={() => setActiveTab('distribute')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center ${
              activeTab === 'distribute' 
                ? 'bg-primary-600 text-white shadow-sm' 
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Send className="w-4 h-4 mr-2" />
            Distribute Stock
          </button>
        )}

        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center ${
            activeTab === 'history' 
              ? 'bg-primary-600 text-white shadow-sm' 
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <History className="w-4 h-4 mr-2" />
          Distribution History
        </button>
      </div>

      {/* Tab Content: Stock Levels */}
      {activeTab === 'stock' && (
        <div className="card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Item</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6 text-right">Available Quantity</th>
                  <th className="py-4 px-6">Unit</th>
                  <th className="py-4 px-6">Status</th>
                  {isStaffOrAdmin && <th className="py-4 px-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-750">
                {inventory.map((item) => {
                  let statusText = '✕ Out of Stock'
                  let statusColor = 'bg-red-50 text-red-700 border-red-205'
                  
                  if (item.quantity > 50) {
                    statusText = '✓ Available'
                    statusColor = 'bg-green-50 text-green-700 border-green-200'
                  } else if (item.quantity >= 1) {
                    statusText = '⚠ Low Stock'
                    statusColor = 'bg-amber-50 text-amber-700 border-amber-250'
                  }
                  
                  let categoryText = item.type
                  if (item.type === 'FERTILIZER') categoryText = 'Fertilizer'
                  else if (item.type === 'SEED') categoryText = 'Seeds'
                  else if (item.type === 'PESTICIDE') categoryText = 'Pesticides'
                  else if (item.type === 'OTHER') categoryText = 'Other'

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6 font-extrabold text-gray-950">{item.name}</td>
                      <td className="py-4 px-6 font-semibold text-gray-550">{categoryText}</td>
                      <td className="py-4 px-6 text-right font-black text-gray-900">{item.quantity}</td>
                      <td className="py-4 px-6 text-gray-500">{item.unit}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
                          {statusText}
                        </span>
                      </td>
                      {isStaffOrAdmin && (
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleOpenUpdateModal(item)}
                            className="px-3.5 py-1.5 bg-primary-50 text-primary-700 border border-primary-150 rounded-xl hover:bg-primary-100 font-bold text-xs transition-all shadow-sm"
                          >
                            Update Stock
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {inventory.length === 0 && (
                  <tr>
                    <td colSpan={isStaffOrAdmin ? 6 : 5} className="py-12 text-center text-gray-500 font-semibold text-sm">
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Log Stock Distribution */}
      {activeTab === 'distribute' && isStaff && (
        <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm max-w-lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Log New Stock Distribution</h3>
          <form onSubmit={handleSubmitDistribution} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select Registered Farmer</label>
              <select
                name="farmerId"
                value={distFormData.farmerId}
                onChange={handleInputChange}
                className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                required
              >
                <option value="">-- Choose Farmer --</option>
                {farmers.map((farmer) => (
                  <option key={farmer.id} value={farmer.id}>
                    {farmer.name} (ID: {farmer.membershipId}) - {farmer.village}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select Inventory Item</label>
              <select
                name="inventoryId"
                value={distFormData.inventoryId}
                onChange={handleInputChange}
                className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                required
              >
                <option value="">-- Choose Item --</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.quantity} {item.unit} available)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity to Distribute</label>
              <input
                type="number"
                step="0.01"
                name="quantity"
                value={distFormData.quantity}
                onChange={handleInputChange}
                placeholder="e.g. 5"
                className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full bg-primary-600 text-white font-bold py-2.5 rounded-xl hover:bg-primary-700 transition-colors shadow-sm flex items-center justify-center text-sm"
            >
              {submitting ? 'Processing...' : 'Submit Distribution'}
            </button>
          </form>
        </div>
      )}

      {/* Tab Content: Distribution History Log */}
      {activeTab === 'history' && (
        <div className="card bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Farmer Name</th>
                  <th className="py-4 px-6">Distributed Item</th>
                  <th className="py-4 px-6">Quantity</th>
                  <th className="py-4 px-6">Date & Time</th>
                  <th className="py-4 px-6">Staff Member</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {distributions.map((dist) => (
                  <tr key={dist.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-gray-900">
                      <span>{dist.farmer?.name}</span>
                      <span className="text-xs text-gray-400 block font-normal">ID: {dist.farmer?.membershipId}</span>
                    </td>
                    <td className="py-4 px-6 font-bold text-gray-900">{dist.inventory?.name}</td>
                    <td className="py-4 px-6 font-semibold text-gray-800">
                      {dist.quantity} {dist.inventory?.unit}
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      {new Date(dist.distributedAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-gray-500 font-medium">{dist.distributedBy}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                        {dist.status || 'COMPLETED'}
                      </span>
                    </td>
                  </tr>
                ))}
                {distributions.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-500 font-semibold text-sm">
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADMIN ADD INVENTORY DIALOG */}
      {showAddStockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-5">
              <h2 className="text-lg font-bold">Add Inventory Item</h2>
              <p className="text-xs text-primary-100">Configure new seed/fertilizer stock records</p>
            </div>
            <form onSubmit={handleAddStockSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  value={stockFormData.name}
                  onChange={(e) => setStockFormData({ ...stockFormData, name: e.target.value })}
                  placeholder="e.g. Potash, Maize Seeds"
                  className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Item Type</label>
                <select
                  value={stockFormData.type}
                  onChange={(e) => setStockFormData({ ...stockFormData, type: e.target.value })}
                  className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                >
                  <option value="FERTILIZER">Fertilizer</option>
                  <option value="SEED">Seeds</option>
                  <option value="PESTICIDE">Pesticides</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Starting Stock</label>
                  <input
                    type="number"
                    value={stockFormData.quantity}
                    onChange={(e) => setStockFormData({ ...stockFormData, quantity: e.target.value })}
                    placeholder="e.g. 100"
                    className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Measurement Unit</label>
                  <input
                    type="text"
                    value={stockFormData.unit}
                    onChange={(e) => setStockFormData({ ...stockFormData, unit: e.target.value })}
                    placeholder="Bags, Kg, Liters"
                    className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Low Stock Alert Threshold</label>
                <input
                  type="number"
                  value={stockFormData.minStock}
                  onChange={(e) => setStockFormData({ ...stockFormData, minStock: e.target.value })}
                  placeholder="e.g. 15"
                  className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-150">
                <button 
                  type="button" 
                  onClick={() => setShowAddStockModal(false)} 
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showUpdateStockModal && selectedInventoryItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
              <h2 className="text-xl font-bold flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Update Stock: {selectedInventoryItem.name}
              </h2>
              <p className="text-xs text-primary-100 mt-1">Current Stock: {selectedInventoryItem.quantity} {selectedInventoryItem.unit}</p>
            </div>
            
            <form onSubmit={handleUpdateStockSubmit} className="p-6 space-y-4 overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  value={updateFormData.name}
                  onChange={(e) => setUpdateFormData({ ...updateFormData, name: e.target.value })}
                  className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                  <select
                    value={updateFormData.type}
                    onChange={(e) => setUpdateFormData({ ...updateFormData, type: e.target.value })}
                    className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium bg-white"
                  >
                    <option value="FERTILIZER">Fertilizer</option>
                    <option value="SEED">Seeds</option>
                    <option value="PESTICIDE">Pesticides</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={updateFormData.unit}
                    onChange={(e) => setUpdateFormData({ ...updateFormData, unit: e.target.value })}
                    className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={updateFormData.amount}
                    onChange={(e) => setUpdateFormData({ ...updateFormData, amount: e.target.value })}
                    placeholder="e.g. 50"
                    className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Action</label>
                  <div className="space-y-1.5 mt-1 text-xs">
                    <label className="flex items-center space-x-2 font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="action"
                        value="ADD"
                        checked={updateFormData.action === 'ADD'}
                        onChange={() => setUpdateFormData({ ...updateFormData, action: 'ADD' })}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <span>Add Stock</span>
                    </label>
                    <label className="flex items-center space-x-2 font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="action"
                        value="REDUCE"
                        checked={updateFormData.action === 'REDUCE'}
                        onChange={() => setUpdateFormData({ ...updateFormData, action: 'REDUCE' })}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <span>Reduce Stock</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Alert Threshold</label>
                <input
                  type="number"
                  step="0.01"
                  value={updateFormData.minStock}
                  onChange={(e) => setUpdateFormData({ ...updateFormData, minStock: e.target.value })}
                  className="input-field w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-150">
                <button 
                  type="button" 
                  onClick={() => setShowUpdateStockModal(false)} 
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-extrabold rounded-xl text-xs transition-colors shadow-sm"
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inventory
