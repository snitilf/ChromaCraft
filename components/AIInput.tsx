import React, { useState } from 'react';
import { generatePalette, setAuthToken, UnauthorizedError } from '../services/ai';
import { Palette } from '../types';
import { Sparkles, Loader2, CornerDownLeft } from 'lucide-react';

interface AIInputProps {
  onPaletteGenerated: (palette: Palette) => void;
}

export const AIInput: React.FC<AIInputProps> = ({ onPaletteGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyValue, setKeyValue] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setIsUnauthorized(false);
    try {
      const palette = await generatePalette(prompt);
      onPaletteGenerated(palette);
      setPrompt(''); // Clear input on success
      setShowKeyInput(false);
    } catch (error) {
      console.error(error);
      if (error instanceof UnauthorizedError) {
        setIsUnauthorized(true);
        setError(error.message);
      } else {
        setError(error instanceof Error ? error.message : "Failed to generate palette. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = () => {
    if (!keyValue) return;
    setAuthToken(keyValue);
    setShowKeyInput(false);
    setKeyValue('');
    handleGenerate(); // retry the pending generation with the new token
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="relative group w-full">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-30 group-hover:opacity-100 transition duration-500 blur"></div>
        <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setError(null); // Clear error when user types
              setIsUnauthorized(false);
              setShowKeyInput(false);
            }}
            onKeyDown={handleKeyDown}
            maxLength={500}
            placeholder="Describe a vibe (e.g., 'Scandinavian forest morning' or 'Cyberpunk neon city')..."
            className="w-full p-4 bg-transparent border-none outline-none text-slate-700 placeholder-slate-400 text-sm resize-none min-h-[120px]"
            disabled={loading}
          />
          <div className="flex justify-between items-center px-3 py-3 bg-slate-50/50 border-t border-slate-100">
            <div className="pl-2 text-slate-400 flex items-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-4 h-4 text-indigo-500" />}
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-60 hidden sm:inline-block">AI Powered</span>
              <span className="text-[10px] font-medium tabular-nums opacity-50">{prompt.length}/500</span>
            </div>
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
            >
              {loading ? 'Generating...' : (
                <>
                  Generate
                  <CornerDownLeft className="w-3.5 h-3.5 opacity-70" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
          {error}
          {isUnauthorized && !showKeyInput && (
            <button
              type="button"
              onClick={() => setShowKeyInput(true)}
              className="ml-2 underline font-medium hover:text-red-700"
            >
              Have access?
            </button>
          )}
        </div>
      )}
      {isUnauthorized && showKeyInput && (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveKey();
              }
            }}
            placeholder="Access password"
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSaveKey}
            disabled={!keyValue}
            className="text-xs px-3 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
};