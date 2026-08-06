import React from 'react';
import { ShieldCheck, Minus, Square, X } from 'lucide-react';

export default function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar-brand">
        <ShieldCheck className="titlebar-icon" />
        <span>MetaCheck & Cleaner — Windows 11 Edition</span>
      </div>
      <div className="titlebar-actions">
        <button className="titlebar-btn" title="Свернуть">
          <Minus size={14} />
        </button>
        <button className="titlebar-btn" title="Развернуть">
          <Square size={12} />
        </button>
        <button className="titlebar-btn close" title="Закрыть">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
