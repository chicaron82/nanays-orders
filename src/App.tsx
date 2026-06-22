import { useState } from 'react';
import { Toaster, toast } from 'sonner';
import { ChefHat, ClipboardList, Receipt, BarChart3, Plus, LogOut, Check, X } from 'lucide-react';
import type { Order, OrderRequest } from './types';
import { useOrders } from './hooks/useOrders';
import { useAuth } from './hooks/useAuth';
import { useExpenses } from './hooks/useExpenses';
import { useBackGuard } from './hooks/useBackGuard';
import { useBlockedDays } from './hooks/useBlockedDays';
import { useOrderRequests } from './hooks/useOrderRequests';

import Dashboard from './components/Dashboard';
import CalendarView from './components/CalendarView';
import ExpenseLog from './components/ExpenseLog';
import InsightsView from './components/InsightsView';
import OrderFormModal from './components/OrderFormModal';
import OrderDetailsModal from './components/OrderDetailsModal';
import LoginScreen from './components/LoginScreen';
import PublicRequestPage from './components/PublicRequestPage';
import AcceptingOrdersToggle from './components/AcceptingOrdersToggle';
import RequestsView from './components/RequestsView';
import BuildStamp from './components/BuildStamp';
import { getRepeatCustomers, nextAvailableDate, formatDate, buildRequestConfirmMessage, buildRequestDeclineMessage } from './lib/utils';

interface MainAppProps {
  onLogout: () => void;
  displayName: string;
}

function MainApp({ onLogout, displayName }: MainAppProps) {
  const { orders, loading: ordersLoading, addOrder, updateOrder, deleteOrder } = useOrders();
  const { expenses, addExpense, deleteExpense } = useExpenses();
  const { blockedDays, blockedSet, blockDay, unblockDay } = useBlockedDays();
  const { requests, approveRequest, declineRequest } = useOrderRequests();

  const [tab, setTab] = useState<'orders' | 'requests' | 'expenses' | 'insights'>('orders');
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [newOrderDate, setNewOrderDate] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [blockedWarning, setBlockedWarning] = useState<{ date: string; next: string; reason?: string | null } | null>(null);
  const [requestMsg, setRequestMsg] = useState<{ msg: string; title: string; emoji: string; waLink?: string } | null>(null);

  const buildWaLink = (contact: string, msg: string) => {
    const digits = contact.replace(/\D/g, '');
    return digits ? `https://wa.me/1${digits}?text=${encodeURIComponent(msg)}` : undefined;
  };

  const handleApproveRequest = async (req: OrderRequest) => {
    try {
      await approveRequest(req);
      const msg = buildRequestConfirmMessage(req);
      setRequestMsg({ emoji: '🎉', title: 'Order Confirmed!', msg, waLink: buildWaLink(req.contact, msg) });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeclineRequest = async (req: OrderRequest) => {
    try {
      await declineRequest(req.id!);
      const msg = buildRequestDeclineMessage(req);
      setRequestMsg({ emoji: '🙏', title: 'Request Declined', msg, waLink: buildWaLink(req.contact, msg) });
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

  if (ordersLoading) {
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
          <p className="text-white/90 font-lato text-sm mt-1.5 font-semibold">Welcome back, {displayName} 👋</p>
          <p className="text-white/60 font-lato text-xs mt-0.5 font-medium tracking-wide">Pancit · Lumpia · Made with love 🥟</p>
        </div>
        <div className="flex items-center gap-3">
          <AcceptingOrdersToggle />
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

      <nav className="sticky top-0 z-40 bg-black/40 backdrop-blur-xl border-b border-white/10 mb-6">
        <div className="overflow-x-auto px-4 py-2">
          <div className="flex gap-1.5">
            <button onClick={() => setTab('orders')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${tab === 'orders' ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
              <ClipboardList size={18} /> Calendar
            </button>
            <button onClick={() => setTab('requests')} className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${tab === 'requests' ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
              <ChefHat size={18} /> Requests
              {requests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse">
                  {requests.length}
                </span>
              )}
            </button>
            <button onClick={() => setTab('expenses')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${tab === 'expenses' ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
              <Receipt size={18} /> Expenses
            </button>
            <button onClick={() => setTab('insights')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${tab === 'insights' ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
              <BarChart3 size={18} /> Insights
            </button>
          </div>
        </div>
      </nav>

      <div className="px-6">
        <Dashboard orders={orders} repeatCount={repeatCount} expenses={expenses} />
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
            onDecline={handleDeclineRequest}
          />
        )}
        {tab === 'expenses' && (
          <ExpenseLog expenses={expenses} onAdd={addExpense} onDelete={deleteExpense} />
        )}
        {tab === 'insights' && (
          <InsightsView orders={orders} expenses={expenses} />
        )}
      </main>

      <OrderFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditOrder(null); setNewOrderDate(null); }}
        onSave={handleSaveOrder}
        editOrder={editOrder}
        allOrders={orders}
        initialDate={newOrderDate}
        blockedSet={blockedSet}
        blockedDays={blockedDays}
      />

      <OrderDetailsModal
        key={selectedOrder?.id as string ?? 'none'}
        isOpen={!!selectedOrder}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onEdit={openEdit}
        onDelete={deleteOrder}
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

      {requestMsg && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="text-3xl">{requestMsg.emoji}</div>
            <h3 className="font-playfair text-xl font-black text-stone-800">{requestMsg.title}</h3>
            <p className="text-xs text-stone-500">Copy this message to text it to the customer:</p>
            <textarea
              readOnly
              value={requestMsg.msg}
              className="w-full h-32 border-2 border-stone-200 rounded-xl p-3 text-sm text-stone-700 font-semibold focus:border-orange-500 outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(requestMsg.msg);
                  toast.success('Message copied! 📋');
                  setRequestMsg(null);
                }}
                className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 transition-colors text-sm flex items-center justify-center gap-2"
              >
                Copy &amp; Close
              </button>
              {requestMsg.waLink && (
                <a
                  href={requestMsg.waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setRequestMsg(null)}
                  className="flex-1 bg-[#25D366] text-white font-bold py-3 rounded-xl hover:bg-green-500 transition-colors text-sm flex items-center justify-center gap-2"
                >
                  💬 WhatsApp
                </a>
              )}
              <button
                onClick={() => setRequestMsg(null)}
                className="px-4 py-3 rounded-xl bg-stone-100 text-stone-600 font-bold text-sm hover:bg-stone-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <BuildStamp tone="light" />
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

  const displayName = (session.user.user_metadata?.display_name as string | undefined)
    ?? session.user.email?.split('@')[0]
    ?? 'Chef';

  return <MainApp onLogout={signOut} displayName={displayName} />;
}
