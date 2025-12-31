'use client';

import { useState } from 'react';
import AppShell from '../../components/AppShell';

const orderSets = [
  { id: 'admission', name: 'NICU Admission', items: 12 },
  { id: 'sepsis', name: 'Sepsis Workup', items: 8 },
  { id: 'rds', name: 'RDS Management', items: 6 },
  { id: 'hyperbili', name: 'Hyperbilirubinemia', items: 5 },
  { id: 'hypoglycemia', name: 'Hypoglycemia Protocol', items: 4 },
];

const recentOrders = [
  { id: 1, type: 'Lab', order: 'CBC with Diff', patient: 'Baby Martinez', status: 'Pending', priority: 'Routine', orderedBy: 'Dr. Chen', time: '10:30' },
  { id: 2, type: 'Lab', order: 'Blood Culture', patient: 'Baby Martinez', status: 'Collected', priority: 'STAT', orderedBy: 'Dr. Chen', time: '10:30' },
  { id: 3, type: 'Med', order: 'Ampicillin 50mg/kg IV', patient: 'Baby Martinez', status: 'Administered', priority: 'STAT', orderedBy: 'Dr. Chen', time: '10:35' },
  { id: 4, type: 'Med', order: 'Gentamicin 4mg/kg IV', patient: 'Baby Martinez', status: 'Scheduled', priority: 'Routine', orderedBy: 'Dr. Chen', time: '10:35' },
  { id: 5, type: 'Imaging', order: 'Chest X-Ray', patient: 'Baby Thompson', status: 'Completed', priority: 'Routine', orderedBy: 'Dr. Patel', time: '09:15' },
  { id: 6, type: 'Lab', order: 'Bilirubin (Total/Direct)', patient: 'Baby Williams', status: 'Pending', priority: 'Routine', orderedBy: 'Dr. Chen', time: '08:00' },
];

const orderCategories = [
  { id: 'labs', name: 'Laboratory', icon: '🧪', items: ['CBC', 'BMP', 'Blood Culture', 'Bilirubin', 'Blood Gas', 'Glucose', 'CRP', 'Procalcitonin'] },
  { id: 'meds', name: 'Medications', icon: '💊', items: ['Ampicillin', 'Gentamicin', 'Caffeine', 'Surfactant', 'Vancomycin', 'Dopamine', 'Fentanyl'] },
  { id: 'imaging', name: 'Imaging', icon: '📷', items: ['Chest X-Ray', 'Abdominal X-Ray', 'Head Ultrasound', 'Echocardiogram', 'Renal Ultrasound'] },
  { id: 'nursing', name: 'Nursing', icon: '👩‍⚕️', items: ['Vital Signs Q1H', 'Strict I/O', 'Daily Weights', 'Phototherapy', 'Isolette Humidity'] },
  { id: 'consults', name: 'Consults', icon: '📋', items: ['Cardiology', 'Surgery', 'Ophthalmology', 'Neurology', 'Genetics'] },
  { id: 'respiratory', name: 'Respiratory', icon: '🫁', items: ['Intubation', 'CPAP', 'High Flow NC', 'Surfactant Admin', 'Extubation'] },
];

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState('active');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState('Baby Martinez');
  const [orders, setOrders] = useState(recentOrders);
  const [selectedItems, setSelectedItems] = useState([]);
  const [orderPriority, setOrderPriority] = useState('Routine');

  const handleToggleItem = (item) => {
    if (selectedItems.includes(item)) {
      setSelectedItems(selectedItems.filter(i => i !== item));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handlePlaceOrder = () => {
    if (selectedItems.length > 0) {
      const category = orderCategories.find(c => c.id === selectedCategory);
      const typeMap = { labs: 'Lab', meds: 'Med', imaging: 'Imaging', nursing: 'Nursing', consults: 'Consult', respiratory: 'Resp' };
      const newOrders = selectedItems.map((item, index) => ({
        id: orders.length + index + 1,
        type: typeMap[selectedCategory] || 'Other',
        order: item,
        patient: selectedPatient,
        status: 'Pending',
        priority: orderPriority,
        orderedBy: 'Dr. Chen',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      }));
      setOrders([...newOrders, ...orders]);
      setSelectedItems([]);
      setSelectedCategory(null);
      setOrderPriority('Routine');
      setShowNewOrder(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-500/20 text-yellow-400';
      case 'Collected': return 'bg-blue-500/20 text-blue-400';
      case 'Administered': return 'bg-green-500/20 text-green-400';
      case 'Scheduled': return 'bg-purple-500/20 text-purple-400';
      case 'Completed': return 'bg-green-500/20 text-green-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Lab': return 'text-cyan-400';
      case 'Med': return 'text-green-400';
      case 'Imaging': return 'text-purple-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Clinical Orders</h1>
            <p className="text-slate-400 text-sm">Order entry and management</p>
          </div>
          <div className="flex items-center gap-3">
            <select className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white">
              <option>All Patients</option>
              <option>Baby Martinez</option>
              <option>Baby Thompson</option>
              <option>Baby Williams</option>
            </select>
            <button
              onClick={() => setShowNewOrder(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Order
            </button>
          </div>
        </div>

        {/* Quick Order Sets */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Quick Order Sets</h3>
          <div className="flex gap-2 flex-wrap">
            {orderSets.map((set) => (
              <button
                key={set.id}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors"
              >
                {set.name}
                <span className="ml-2 text-xs text-slate-400">({set.items})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700 pb-2">
          {['active', 'pending', 'completed', 'discontinued'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab}
              {tab === 'active' && <span className="ml-2 px-1.5 py-0.5 bg-cyan-500/30 rounded text-xs">6</span>}
              {tab === 'pending' && <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/30 rounded text-xs">2</span>}
            </button>
          ))}
        </div>

        {/* Orders Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                  <th className="p-4">Type</th>
                  <th className="p-4">Order</th>
                  <th className="p-4">Patient</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Ordered By</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="p-4">
                      <span className={`text-sm font-medium ${getTypeColor(order.type)}`}>{order.type}</span>
                    </td>
                    <td className="p-4 text-white font-medium">{order.order}</td>
                    <td className="p-4 text-slate-300">{order.patient}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        order.priority === 'STAT' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {order.priority}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-sm">{order.orderedBy}</td>
                    <td className="p-4 text-slate-400 text-sm">{order.time}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* New Order Modal */}
        {showNewOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-4xl border border-slate-700 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">New Order</h3>
                <button onClick={() => setShowNewOrder(false)} className="text-slate-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Patient Selection */}
              <div className="mb-6">
                <label className="block text-sm text-slate-400 mb-2">Patient</label>
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option>Baby Martinez</option>
                  <option>Baby Thompson</option>
                  <option>Baby Williams</option>
                </select>
              </div>

              {/* Order Categories */}
              <div className="grid grid-cols-6 gap-3 mb-6">
                {orderCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                    className={`p-4 rounded-lg text-center transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-cyan-500/20 border border-cyan-500/50'
                        : 'bg-slate-700 hover:bg-slate-600 border border-transparent'
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <div className="text-sm text-white mt-1">{cat.name}</div>
                  </button>
                ))}
              </div>

              {/* Order Items */}
              {selectedCategory && (
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-3">
                    {orderCategories.find(c => c.id === selectedCategory)?.name} Orders
                    {selectedItems.length > 0 && (
                      <span className="ml-2 text-cyan-400">({selectedItems.length} selected)</span>
                    )}
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {orderCategories.find(c => c.id === selectedCategory)?.items.map((item) => (
                      <button
                        key={item}
                        onClick={() => handleToggleItem(item)}
                        className={`p-3 rounded-lg text-left transition-colors ${
                          selectedItems.includes(item)
                            ? 'bg-cyan-500/20 border border-cyan-500/50'
                            : 'bg-slate-800 hover:bg-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            selectedItems.includes(item) ? 'bg-cyan-500 border-cyan-500' : 'border-slate-500'
                          }`}>
                            {selectedItems.includes(item) && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm text-white">{item}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Priority Selection */}
              {selectedItems.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm text-slate-400 mb-2">Priority</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        checked={orderPriority === 'Routine'}
                        onChange={() => setOrderPriority('Routine')}
                        className="text-cyan-500"
                      />
                      <span className="text-white">Routine</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        checked={orderPriority === 'STAT'}
                        onChange={() => setOrderPriority('STAT')}
                        className="text-cyan-500"
                      />
                      <span className="text-red-400 font-medium">STAT</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
                <button
                  onClick={() => {
                    setShowNewOrder(false);
                    setSelectedItems([]);
                    setSelectedCategory(null);
                  }}
                  className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={selectedItems.length === 0}
                  className={`flex-1 py-2 rounded-lg ${
                    selectedItems.length > 0
                      ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Place Order {selectedItems.length > 0 && `(${selectedItems.length})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
