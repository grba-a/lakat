"use client";

import { createPortal } from "react-dom";
import CommentThread from "./comment-thread";

// Bottom sheet za komentare u feedu (IG stil) — komentari se učitavaju
// tek na otvaranje (lazy obrazac iz comment-thread.jsx). Portal u body:
// glass-nav backdrop-filter je containing block za fixed potomke.
export default function CommentSheet({ checkinId, currentUserId, onClose }) {
  if (!checkinId) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Komentari"
    >
      <div
        className="w-full max-w-sm rounded-t-3xl border-t border-white/10 bg-[#131316] px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">
          Komentari
        </p>
        <div className="mx-auto w-full max-w-xs">
          <CommentThread checkinId={checkinId} currentUserId={currentUserId} />
        </div>
      </div>
    </div>,
    document.body
  );
}
