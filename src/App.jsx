import { useState } from 'react';
import { Toaster } from 'sonner';
import { ChefHat, ClipboardList, PackageOpen, Plus, LogOut } from 'lucide-react';
import { useOrders } from './hooks/useOrders';
import { useStock } from './hooks/useStock';
import { useAuth } from './hooks/useAuth';

import Dashboard from './components/Dashboard';
import KanbanBoard from './components/KanbanBoard';
import StockManager from './components/StockManager';
import OrderFormModal from './components/OrderFormModal';
import OrderDetailsModal from './components/OrderDetailsModal';
import LoginScreen from './components/LoginScreen';
import { getRepeatCustomers } from './lib/utils';

function MainApp({ onLogout }) {
  const { orders, loading: ordersLoading, addOrder, updateOrder, deleteOrder } = useOrders();
  const { stock, loading: stockLoading, updateStock } = useStock();

  const [tab, setTab] = useState('orders');
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editOrder, setEditOrder] = useState(null);

  const repeatMap = getRepeatCustomers(orders);
  const repeatCount = Object.values(repeatMap).filter(count => count >= 2).length;

  const handleStatusChange = (id, newStatus) => {
    updateOrder(id, { order_status: newStatus });
    if (selectedOrder?.id === id) {
      setSelectedOrder({ ...selectedOrder, order_status: newStatus });
    }
  };

  const handleSaveOrder = async (orderData) => {
    if (orderData.id) {
      await updateOrder(orderData.id, orderData);
    } else {
      await addOrder(orderData);
    }
    setShowForm(false);
    setEditOrder(null);
  };

  const openEdit = (order) => {
    setEditOrder(order);
    setSelectedOrder(null);
    setShowForm(true);
  };

  if (ordersLoading || stockLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <ChefHat className="text-white animate-bounce w-16 h-16" />
        <div className="text-white font-playfair text-xl">Warming up the kitchen...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pt-8 pb-20 relative">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="px-6 mb-8 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="font-playfair text-white text-4xl sm:text-5xl font-black drop-shadow-md flex items-center justify-center sm:justify-start gap-3">
            <span>🍜</span> Nanay's Orders
          </h1>
          <p className="text-white/80 font-lato text-sm mt-2 font-medium tracking-wide">Pancit · Lumpia · Made with love 🥟</p>
        </div>
        <div className="flex items-center gap-3">
          {tab === 'orders' && (
            <button 
              onClick={() => { setEditOrder(null); setShowForm(true); }}
              className="bg-white text-orange-600 px-6 py-3 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus size={20} /> New Order
            </button>
          )}
          <button 
            onClick={onLogout}
            className="bg-black/20 text-white/90 p-3 rounded-full hover:bg-black/40 transition-colors"
            title="Lock Kitchen"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Dashboard Summary */}
      <div className="px-6">
        <Dashboard orders={orders} repeatCount={repeatCount} />
      </div>

      {/* Tabs */}
      <div className="px-6 mb-6 sticky top-4 z-40">
        <div className="bg-black/40 backdrop-blur-xl p-1.5 rounded-2xl flex max-w-sm border border-white/20 mx-auto sm:mx-0 shadow-lg">
          <button 
            onClick={() => setTab('orders')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === 'orders' ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
          >
            <ClipboardList size={18} /> Kitchen Board
          </button>
          <button 
            onClick={() => setTab('stock')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === 'stock' ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
          >
            <PackageOpen size={18} /> Stock & Prep
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main>
        {tab === 'orders' ? (
          <KanbanBoard 
            orders={orders} 
            stock={stock} 
            updateOrderStatus={handleStatusChange} 
            onOrderClick={setSelectedOrder} 
          />
        ) : (
          <StockManager 
            stock={stock} 
            orders={orders} 
            updateStock={updateStock} 
          />
        )}
      </main>

      {/* Modals */}
      <OrderFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditOrder(null); }}
        onSave={handleSaveOrder}
        editOrder={editOrder}
        allOrders={orders}
        stock={stock}
      />

      <OrderDetailsModal 
        isOpen={!!selectedOrder}
        order={selectedOrder}
        stock={stock}
        allOrders={orders}
        onClose={() => setSelectedOrder(null)}
        onEdit={openEdit}
        onDelete={deleteOrder}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

export default function App() {
  const { session, loading, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#B5350F]">
        <ChefHat className="text-white animate-bounce w-16 h-16" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={signIn} />;
  }

  return <MainApp onLogout={signOut} />;
}
