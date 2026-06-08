import { useState } from 'react';
import { Toaster, toast } from 'sonner';
import { ChefHat, ClipboardList, PackageOpen, Receipt, BarChart3, Plus, LogOut, Check, X } from 'lucide-react';
import type { Order, OrderStatus, OrderRequest } from './types';
import { useOrders } from './hooks/useOrders';
import { useStock } from './hooks/useStock';
import { useAuth } from './hooks/useAuth';
import { useExpenses } from './hooks/useExpenses';
import { useBackGuard } from './hooks/useBackGuard';
import { useBlockedDays } from './hooks/useBlockedDays';
import { useOrderRequests } from './hooks/useOrderRequests';

import Dashboard from './components/Dashboard';
import CalendarView from './components/CalendarView';
import StockManager from './components/StockManager';
import ExpenseLog from './components/ExpenseLog';
import InsightsView from './components/InsightsView';
import OrderFormModal from './components/OrderFormModal';
import OrderDetailsModal from './components/OrderDetailsModal';
import LoginScreen from './components/LoginScreen';
import PublicRequestPage from './components/PublicRequestPage';
import RequestsView from './components/RequestsView';
import { getRepeatCustomers, nextAvailableDate, formatDate, fmt } from './lib/utils';

interface MainAppProps {
  onLogout: () => void;
}

function MainApp({ onLogout }: MainAppProps) {
  const { orders, loading: ordersLoading, addOrder, updateOrder, deleteOrder } = useOrders();
  const { stock, loading: stockLoading, updateStock } = useStock();
  const { expenses, addExpense, deleteExpense } = useExpenses();
  const { blockedDays, blockedSet, blockDay, unblockDay } = useBlockedDays();
  const { requests, approveRequest, declineRequest } = useOrderRequests();

  const [tab, setTab] = useState<'orders' | 'requests' | 'stock' | 'expenses' | 'insights'>('orders');
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [newOrderDate, setNewOrderDate] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [blockedWarning, setBlockedWarning] = useState<{ date: string; next: string; reason?: string | null } | null>(null);
  const [approvedRequestMsg, setApprovedRequestMsg] = useState<string | null>(null);

  const handleApproveRequest = async (req: OrderRequest) => {
    try {
      await approveRequest(req);
      const msg = `Hey ${req.customer_name}! Your order for ${formatDate(req.needed_date)} at ${req.pickup_time} is confirmed! Total: ${fmt(req.total)} (${req.delivery_type === 'pickup' ? '🏠 Pickup' : `🚗 Delivery to: ${req.address}`}). Thank you! 🥟🍜`;
      setApprovedRequestMsg(msg);
    } catch (e) {
      console.error(e);
    }
  };

  useBackGuard([
    { isActive: showForm,        onBack: () => { setShowForm(false); setEditOrder(null); setNewOrderDate(null); } },
    { isActive: !!selectedOrder, onBack: () => setSelectedOrder(null) },
  ]);

  const repeatMap = getRepeatCustomers(orders);
  const repeatCount = Object.values(repeatMap).filter(count => count >= 2).length;

  const handleStatusChange = (id: string | number, newStatus: OrderStatus) => {
    updateOrder(id, { order_status: newStatus });
    if (selectedOrder?.id === id) {
      setSelectedOrder({ ...selectedOrder, order_status: newStatus });
    }

    if (newStatus === 'Fulfilled') {
      const order = orders.find(o => o.id === id);
      if (order) {
        const deductions: typeof stock = {};
        if (order.lumpia?.enabled) {
          // halves count as 0.5 sets for display/calc, but lumpia_sets is an integer column.
          // Math.round here so 1 half = 1 set deducted; use Math.floor to only deduct on whole sets.
          const sets = Math.round((order.lumpia.sets || 0) + (order.lumpia.halves || 0) * 0.5);
          if (sets > 0) deductions.lumpia_sets = Math.max(0, (stock.lumpia_sets || 0) - sets);
        }
        if (order.pancit?.enabled) {
          if ((order.pancit.full || 0) > 0) deductions.pancit_full = Math.max(0, (stock.pancit_full || 0) - order.pancit.full!);
          if ((order.pancit.half || 0) > 0) deductions.pancit_half = Math.max(0, (stock.pancit_half || 0) - order.pancit.half!);
          if ((order.pancit.large || 0) > 0) deductions.pancit_large = Math.max(0, (stock.pancit_large || 0) - order.pancit.large!);
        }
        if (Object.keys(deductions).length > 0) {
          // Pass only the changed fields — avoids overwriting unrelated stock values in a concurrent session.
          updateStock(deductions, { silent: true });
        }
      }
    }
  };

  const handlePaymentChange = (id: string | number, patch: Partial<Order>) => {
    updateOrder(id, patch);
    if (selectedOrder?.id === id) {
      setSelectedOrder({ ...selectedOrder, ...patch });
    }
  };

  const handleSaveOrder = async (orderData: Order) => {
    if (orderData.id) {
      await updateOrder(orderData.id, orderData);
    } else {
      await addOrder(orderData);
    }
    setShowForm(false);
    setEditOrder(null);
    setNewOrderDate(null);
  };

  const openEdit = (order: Order) => {
    setEditOrder(order);
    setNewOrderDate(null);
    setSelectedOrder(null);
    setShowForm(true);
  };

  const handleNewOrderForDate = (ymd: string) => {
    if (blockedSet.has(ymd)) {
      const next = nextAvailableDate(ymd, blockedSet);
      const reason = blockedDays.find(d => d.date === ymd)?.reason;
      setBlockedWarning({ date: ymd, next, reason });
      return;
    }
    setEditOrder(null);
    setNewOrderDate(ymd);
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
      <Toaster position="bottom-center" richColors />

      <header className="px-6 mb-8 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="font-playfair text-white text-4xl sm:text-5xl font-black drop-shadow-md flex items-center justify-center sm:justify-start gap-3">
            <span aria-hidden="true">🍜</span> Nanay's Orders
          </h1>
          <p className="text-white/80 font-lato text-sm mt-2 font-medium tracking-wide">Pancit · Lumpia · Made with love 🥟</p>
        </div>
        <div className="flex items-center gap-3">
          {tab === 'orders' && (
            <button
              onClick={() => { setEditOrder(null); setNewOrderDate(null); setShowForm(true); }}
              className="bg-white text-orange-600 px-6 py-3 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-[transform,box-shadow] flex items-center gap-2"
            >
              <Plus size={20} /> New Order
            </button>
          )}
          {confirmLogout ? (
            <div className="flex items-center gap-1.5 bg-black/30 rounded-full px-3 py-2">
              <span className="text-white/90 text-sm font-semibold mr-1">Sign out?</span>
              <button onClick={onLogout} className="bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-full transition-colors" aria-label="Confirm sign out">
                <Check size={15} />
              </button>
              <button onClick={() => setConfirmLogout(false)} className="bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-full transition-colors" aria-label="Cancel sign out">
                <X size={15} />
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmLogout(true)} className="bg-black/20 text-white/90 p-3 rounded-full hover:bg-black/40 transition-colors" aria-label="Lock Kitchen">
              <LogOut size={20} />
            </button>
          )}
        </div>
      </header>

      <div className="px-6">
        <Dashboard orders={orders} repeatCount={repeatCount} expenses={expenses} />
      </div>

      <div className="px-6 mb-6 sticky top-4 z-40">
        <div className="bg-black/40 backdrop-blur-xl p-1.5 rounded-2xl flex max-w-xl border border-white/20 mx-auto sm:mx-0 shadow-lg">
          <button onClick={() => setTab('orders')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors ${tab === 'orders' ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
            <ClipboardList size={18} /> Calendar
          </button>
          <button onClick={() => setTab('requests')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors relative ${tab === 'requests' ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
            <ChefHat size={18} /> Requests
            {requests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse">
                {requests.length}
              </span>
            )}
          </button>
          <button onClick={() => setTab('stock')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors ${tab === 'stock' ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
            <PackageOpen size={18} /> Stock &amp; Prep
          </button>
          <button onClick={() => setTab('expenses')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors ${tab === 'expenses' ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
            <Receipt size={18} /> Expenses
          </button>
          <button onClick={() => setTab('insights')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors ${tab === 'insights' ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
            <BarChart3 size={18} /> Insights
          </button>
        </div>
      </div>

      <main>
        {tab === 'orders' && (
          <CalendarView
            orders={orders}
            blockedDays={blockedDays}
            blockedSet={blockedSet}
            onOrderClick={setSelectedOrder}
            onNewOrderForDate={handleNewOrderForDate}
            onBlockDay={blockDay}
            onUnblockDay={unblockDay}
          />
        )}
        {tab === 'requests' && (
          <RequestsView
            requests={requests}
            blockedSet={blockedSet}
            onApprove={handleApproveRequest}
            onDecline={declineRequest}
          />
        )}
        {tab === 'stock' && (
          <StockManager stock={stock} orders={orders} updateStock={updateStock} />
        )}
        {tab === 'expenses' && (
          <ExpenseLog expenses={expenses} onAdd={addExpense} onDelete={deleteExpense} />
        )}
        {tab === 'insights' && (
          <InsightsView orders={orders} />
        )}
      </main>

      <OrderFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditOrder(null); setNewOrderDate(null); }}
        onSave={handleSaveOrder}
        editOrder={editOrder}
        allOrders={orders}
        stock={stock}
        initialDate={newOrderDate}
        blockedSet={blockedSet}
        blockedDays={blockedDays}
      />

      <OrderDetailsModal
        key={selectedOrder?.id as string ?? 'none'}
        isOpen={!!selectedOrder}
        order={selectedOrder}
        stock={stock}
        allOrders={orders}
        onClose={() => setSelectedOrder(null)}
        onEdit={openEdit}
        onDelete={deleteOrder}
        onStatusChange={handleStatusChange}
        onPaymentChange={handlePaymentChange}
      />

      {blockedWarning && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setBlockedWarning(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="text-2xl mb-1">🔒</div>
            <div className="font-playfair text-lg font-black text-stone-800 mb-1">{formatDate(blockedWarning.date)} is off</div>
            {blockedWarning.reason && <p className="text-sm text-stone-500 mb-3">{blockedWarning.reason}</p>}
            <p className="text-sm text-stone-600 mb-4">
              Next open day: <span className="font-bold text-orange-600">{formatDate(blockedWarning.next)}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setBlockedWarning(null); setEditOrder(null); setNewOrderDate(blockedWarning.next); setShowForm(true); }}
                className="flex-1 bg-orange-500 text-white font-bold py-2.5 rounded-xl hover:bg-orange-600 transition-colors text-sm"
              >
                Book for {formatDate(blockedWarning.next)}
              </button>
              <button
                onClick={() => setBlockedWarning(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-600 font-bold text-sm hover:bg-stone-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {approvedRequestMsg && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="text-3xl">🎉</div>
            <h3 className="font-playfair text-xl font-black text-stone-800">Order Confirmed!</h3>
            <p className="text-xs text-stone-500">
              Copy this message to text it to the customer:
            </p>
            <textarea
              readOnly
              value={approvedRequestMsg}
              className="w-full h-32 border-2 border-stone-200 rounded-xl p-3 text-sm text-stone-700 font-semibold focus:border-orange-500 outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(approvedRequestMsg);
                  toast.success('Confirmation message copied to clipboard! 📋');
                  setApprovedRequestMsg(null);
                }}
                className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 transition-colors text-sm flex items-center justify-center gap-2"
              >
                Copy &amp; Close
              </button>
              <button
                onClick={() => setApprovedRequestMsg(null)}
                className="px-4 py-3 rounded-xl bg-stone-100 text-stone-600 font-bold text-sm hover:bg-stone-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { session, loading, signIn, signOut } = useAuth();

  const isRequestPage =
    window.location.pathname === '/request' ||
    window.location.search.includes('request=true') ||
    window.location.hash === '#/request';

  if (isRequestPage) {
    return (
      <>
        <PublicRequestPage />
        <Toaster position="top-center" richColors />
      </>
    );
  }

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
