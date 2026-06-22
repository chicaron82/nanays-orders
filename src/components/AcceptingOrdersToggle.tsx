import { useStoreSettings } from '../hooks/useStoreSettings';

/**
 * Kitchen control for the public request form: live vs paused. When paused, the
 * public page stops taking orders and points customers to Facebook Messenger.
 * Loud amber when off, so it's never silently left paused.
 */
export default function AcceptingOrdersToggle() {
  const { acceptingRequests, loading, setAccepting } = useStoreSettings();
  if (loading) return null;

  return (
    <button
      onClick={() => setAccepting(!acceptingRequests)}
      title={acceptingRequests
        ? 'Online order form is live — tap to pause and send customers to Facebook'
        : 'Online orders paused (customers see “order on Facebook”) — tap to resume'}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm shadow-lg transition-colors ${
        acceptingRequests
          ? 'bg-white/20 text-white hover:bg-white/30'
          : 'bg-amber-400 text-amber-950 hover:bg-amber-300'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${acceptingRequests ? 'bg-emerald-300' : 'bg-amber-900'}`} />
      {acceptingRequests ? 'Orders: Live' : 'Orders: Paused'}
    </button>
  );
}
