import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { orderSummary, formatDate, fmt, urgencyLabel, getDaysUntil, checkShortage, isRepeat } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Star } from 'lucide-react';

const COLUMNS = ["Pending", "Ready", "Fulfilled", "Cancelled"];

export default function KanbanBoard({ orders, stock, updateOrderStatus, onOrderClick }) {
  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return; // Same column, we don't care about order inside column for now

    updateOrderStatus(draggableId, destination.droppableId);
  };

  const ordersByStatus = COLUMNS.reduce((acc, col) => {
    acc[col] = orders.filter(o => o.order_status === col);
    return acc;
  }, {});

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 px-4 items-start h-[calc(100vh-280px)] min-h-[400px] snap-x snap-mandatory hide-scrollbar">
        {COLUMNS.map(col => (
          <div key={col} className="w-[85vw] max-w-[340px] flex-shrink-0 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 flex flex-col h-full overflow-hidden snap-center">
            <div className="p-3 bg-white/20 border-b border-white/10 font-bold text-white tracking-wide uppercase text-sm flex justify-between items-center shadow-sm">
              {col}
              <span className="bg-black/20 text-xs px-2 py-1 rounded-full">{ordersByStatus[col].length}</span>
            </div>
            
            <Droppable droppableId={col}>
              {(provided, snapshot) => (
                <div 
                  ref={provided.innerRef} 
                  {...provided.droppableProps}
                  className={`flex-1 p-3 overflow-y-auto space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                >
                  <AnimatePresence>
                    {ordersByStatus[col].map((order, index) => {
                      const total = order.total ?? 0;
                      const shortage = order.order_status === "Pending" ? checkShortage(order, stock, orders.filter(o => o.id !== order.id && o.order_status === "Ready")).length > 0 : false;
                      const days = getDaysUntil(order.needed_date);
                      const urgency = urgencyLabel(days);
                      const repeat = isRepeat(order.customer_name, orders, order.id);

                      return (
                        <Draggable key={order.id} draggableId={order.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{ ...provided.draggableProps.style }}
                            >
                              <motion.div 
                                layoutId={order.id}
                                onClick={() => onOrderClick(order)}
                                className={`bg-white rounded-xl p-4 shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden ${
                                  shortage ? 'border-l-red-500' : 
                                  col === 'Ready' ? 'border-l-blue-500' : 
                                  col === 'Fulfilled' ? 'border-l-emerald-500' : 
                                  col === 'Cancelled' ? 'border-l-stone-400' : 'border-l-orange-500'
                                }`}
                              >
                                {snapshot.isDragging && <div className="absolute inset-0 bg-orange-500/5 z-0" />}
                                <div className="relative z-10">
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="font-playfair font-bold text-lg text-stone-800 leading-tight truncate">
                                      {order.customer_name}
                                    </div>
                                    <div className="font-playfair font-black text-orange-600">
                                      {fmt(total)}
                                    </div>
                                  </div>
                                  
                                  <div className="text-xs text-stone-500 mt-1 line-clamp-2">
                                    {orderSummary(order)}
                                  </div>
                                  
                                  <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <span className="text-xs text-stone-400 font-medium bg-stone-100 px-2 py-1 rounded-md">
                                      {formatDate(order.needed_date)}
                                    </span>
                                    {urgency && col === "Pending" && (
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${urgency.tailwind}`}>
                                        {urgency.text}
                                      </span>
                                    )}
                                    {repeat && <Star className="text-amber-400 w-4 h-4 fill-current" />}
                                  </div>

                                  {shortage && (
                                    <div className="mt-2 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold px-2 py-1.5 rounded flex items-center gap-1.5">
                                      <AlertTriangle size={12} /> Stock shortage
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                  </AnimatePresence>
                  {provided.placeholder}
                  {ordersByStatus[col].length === 0 && !snapshot.isDraggingOver && (
                    <div className="h-full flex items-center justify-center text-white/40 text-sm font-medium p-6 text-center border-2 border-dashed border-white/20 rounded-xl">
                      Drop orders here
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
