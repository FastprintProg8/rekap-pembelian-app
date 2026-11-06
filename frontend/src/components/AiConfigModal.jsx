import React, { useState, useEffect } from 'react';
import { X, KeyRound, Sparkles, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

export default function AiConfigModal({ isOpen, onClose, currentKey, onSave }) {
  const [apiKey, setApiKey] = useState(currentKey || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setApiKey(currentKey || '');
  }, [currentKey, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSave(apiKey.trim());
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col my-auto border border-slate-200">
        
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Pengaturan AI Token</h2>
              <p className="text-xs text-slate-500">Google Gemini / AI Pembaca Nota Otomatis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-teal-600" />
              API Key Gemini / Anthropic
            </label>
            <input
              type="password"
              placeholder="Masukkan API Key (AIzaSy... / sk-ant-...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
              autoComplete="off"
            />
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              Kunci API disimpan secara aman di database server (dan browser Anda). Fitur ini digunakan untuk membaca foto struk, marketplace, dan nota fisik secara otomatis.
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Belum punya API Key Gemini gratis?</span>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-teal-700 hover:underline font-semibold flex items-center gap-1 shrink-0"
            >
              Buat Kunci <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Menyimpan...' : 'Simpan Kunci API'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
