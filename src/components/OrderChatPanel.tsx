import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { fetchOrderMessages, sendOrderMessage } from '../services/api.ts';
import type { OrderDTO, OrderMessageDTO, UserProfile } from '../types.ts';
import {
  MAX_ORDER_MESSAGE_LENGTH,
  ORDER_STATUS,
  mergeOrderMessagesIdempotent,
  validateOrderMessage,
} from '../utils/orders.ts';

interface OrderChatPanelProps {
  order: OrderDTO;
  currentUser: UserProfile;
  realtimeMessages: OrderMessageDTO[];
}

export function OrderChatPanel({
  order,
  currentUser,
  realtimeMessages,
}: OrderChatPanelProps) {
  const hasDriver = order.driverId !== null || Boolean(order.driverName);
  const isDefaultOpen = hasDriver && order.status !== ORDER_STATUS.DELIVERED;

  const [open, setOpen] = useState(isDefaultOpen);
  const [messages, setMessages] = useState<OrderMessageDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hasDriver && order.status === ORDER_STATUS.OUT_FOR_DELIVERY && !loadedOnce) {
      setOpen(true);
    }
  }, [hasDriver, order.status, loadedOnce]);

  useEffect(() => {
    if (!open || !hasDriver) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchOrderMessages(order.id)
      .then((list) => {
        if (!active) return;
        setMessages((prev) => {
          let merged = list;
          for (const rt of prev) {
            merged = mergeOrderMessagesIdempotent(merged, rt);
          }
          return merged;
        });
        setLoadedOnce(true);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load messages.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, hasDriver, order.id]);

  useEffect(() => {
    if (!realtimeMessages.length) return;
    setMessages((prev) => {
      let next = prev;
      for (const msg of realtimeMessages) {
        next = mergeOrderMessagesIdempotent(next, msg);
      }
      return next;
    });
  }, [realtimeMessages]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages.length]);

  if (!hasDriver) {
    return (
      <div className="order-chat-locked" data-testid={`order-chat-locked-${order.id}`}>
        <MessageSquare size={14} aria-hidden="true" />
        <span>Direct driver chat unlocks once a driver accepts your pickup.</span>
      </div>
    );
  }

  const counterpartLabel =
    currentUser.role === 'driver'
      ? `Customer (${order.buyerName})`
      : `Driver (${order.driverName || 'Assigned'})`;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const check = validateOrderMessage(draft);
    if (!check.valid) {
      setError(check.error);
      return;
    }

    setSending(true);
    try {
      const sent = await sendOrderMessage(order.id, check.body);
      setMessages((prev) => mergeOrderMessagesIdempotent(prev, sent));
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      className="order-chat"
      aria-label={`Direct chat for order ${order.id}`}
      data-testid={`order-chat-${order.id}`}
    >
      <div className="order-chat-bar">
        <button
          type="button"
          className="order-chat-toggle"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <MessageSquare size={15} aria-hidden="true" />
          <span>
            Message {counterpartLabel}
            {messages.length > 0 ? ` (${messages.length})` : ''}
          </span>
        </button>
      </div>

      {open && (
        <div className="order-chat-body">
          <div
            ref={listRef}
            className="order-chat-messages"
            role="log"
            aria-live="polite"
            aria-label={`Messages for ${order.id}`}
          >
            {loading && messages.length === 0 ? (
              <div className="order-chat-empty">Loading conversation...</div>
            ) : messages.length === 0 ? (
              <div className="order-chat-empty">
                No messages yet. Share delivery notes, gate info, or ETA updates here.
              </div>
            ) : (
              messages.map((msg) => {
                const isSelf = msg.senderId === currentUser.id;
                return (
                  <div
                    key={msg.id}
                    className={`order-chat-msg ${
                      isSelf ? 'order-chat-msg-self' : 'order-chat-msg-peer'
                    }`}
                  >
                    <div className="order-chat-msg-meta">
                      <span>
                        {isSelf
                          ? 'You'
                          : `${msg.senderRole === 'driver' ? 'Driver' : 'Customer'} • ${msg.senderName}`}
                      </span>
                      <span>{msg.createdAt}</span>
                    </div>
                    <div className="order-chat-msg-text">{msg.body}</div>
                  </div>
                );
              })
            )}
          </div>

          {error && <div className="field-error" style={{ marginBottom: '8px' }}>{error}</div>}

          <form className="order-chat-form" onSubmit={handleSubmit}>
            <input
              type="text"
              className="order-chat-input"
              aria-label={`Message to ${counterpartLabel} for ${order.id}`}
              placeholder={`Write a message to ${counterpartLabel}...`}
              maxLength={MAX_ORDER_MESSAGE_LENGTH}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              disabled={sending}
            />
            <button
              type="submit"
              className="btn-gold order-chat-send"
              disabled={sending}
              aria-label={`Send message for ${order.id}`}
            >
              <Send size={14} aria-hidden="true" />
              <span>{sending ? 'Sending...' : 'Send'}</span>
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
