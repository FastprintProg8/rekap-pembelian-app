import React from 'react';
import { X, ExternalLink, Download } from 'lucide-react';
import { resolveImageUrl } from '../utils/formatters';

export default function ImagePreviewModal({ isOpen, onClose, src, title = 'Foto Nota' }) {
  if (!isOpen || !src) return null;

  const resolvedUrl = resolveImageUrl(src);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition"
              title="Buka tab baru"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Tab Baru</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Gambar Preview */}
        <div className="p-4 overflow-auto flex items-center justify-center bg-slate-950/5 min-h-[300px]">
          <img
            src={resolvedUrl}
            alt={title}
            className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}

