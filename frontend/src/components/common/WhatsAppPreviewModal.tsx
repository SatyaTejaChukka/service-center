import React, { useState, useEffect } from 'react';
import { X, Send, Copy, Check, MessageCircle, Phone } from 'lucide-react';
import { openWhatsApp, normalizeWhatsAppPhone } from '../../lib/whatsapp';

interface WhatsAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  customerName: string;
  customerPhone: string;
  altPhone?: string;
  initialMessage: string;
}

export const WhatsAppPreviewModal: React.FC<WhatsAppPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  customerName,
  customerPhone,
  altPhone,
  initialMessage
}) => {
  const [selectedPhone, setSelectedPhone] = useState(customerPhone);
  const [message, setMessage] = useState(initialMessage);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMessage(initialMessage);
    setSelectedPhone(customerPhone);
    setCopied(false);
  }, [initialMessage, customerPhone]);

  if (!isOpen) return null;

  const cleanPhone = normalizeWhatsAppPhone(selectedPhone);

  const handleSend = () => {
    openWhatsApp(cleanPhone, message);
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col border border-workshop-border animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-[#075E54] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white shadow-sm shrink-0">
              <MessageCircle className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">{title}</h3>
              <p className="text-[11px] text-emerald-100 opacity-90">1-Click WhatsApp Communication (₹0 API Cost)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-black/15 flex items-center justify-center transition cursor-pointer text-emerald-100 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 bg-gray-50 flex-1">
          
          {/* Recipient Details & Phone Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-workshop-border-soft text-xs">
            <div>
              <span className="text-workshop-muted block text-[11px]">Recipient:</span>
              <span className="font-bold text-workshop-text text-sm">{customerName}</span>
            </div>

            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-workshop-muted" />
              {altPhone ? (
                <select
                  value={selectedPhone}
                  onChange={(e) => setSelectedPhone(e.target.value)}
                  className="px-2 py-1 bg-gray-100 border border-gray-300 rounded font-mono font-medium text-xs focus:ring-1 focus:ring-emerald-500"
                >
                  <option value={customerPhone}>Primary: {customerPhone}</option>
                  <option value={altPhone}>Alt: {altPhone}</option>
                </select>
              ) : (
                <span className="font-mono font-bold text-workshop-text bg-gray-100 px-2 py-0.5 rounded">
                  {customerPhone || 'No phone'}
                </span>
              )}
            </div>
          </div>

          {/* WhatsApp Chat Simulation Container */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-workshop-muted">
              <span className="font-semibold">Message Preview (Editable):</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied to clipboard' : 'Copy text'}
              </button>
            </div>

            {/* Chat Bubble with WhatsApp Wallpaper feel */}
            <div className="p-3.5 bg-[#E5DDD5] rounded-xl border border-gray-300 flex justify-end">
              <div className="bg-[#DCF8C6] rounded-xl rounded-tr-none p-3 shadow-xs max-w-full w-full border border-[#C5E1A5] space-y-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  className="w-full text-xs font-mono bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-[#303030] leading-relaxed selection:bg-[#25D366] selection:text-white"
                  placeholder="Type WhatsApp message here..."
                />
                <div className="flex justify-end items-center gap-1 text-[10px] text-gray-500 font-mono select-none">
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-[#34B7F1] font-bold">✓✓</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-workshop-muted italic">
              💡 You can edit or add notes above before opening WhatsApp. Formatting like *bold* is preserved.
            </p>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-white border-t border-workshop-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-workshop-muted hover:text-workshop-text hover:bg-gray-100 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSend}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer active:scale-98"
            >
              <Send className="w-4 h-4 fill-white" />
              Open in WhatsApp
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
