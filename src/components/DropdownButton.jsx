import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Globe } from "lucide-react";

const languages = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
];

export const LanguageDropdown = ({ isDark = true, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(languages[0]);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (language) => {
    setSelected(language);
    setIsOpen(false);
    onChange?.(language);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2 py-2 rounded-xl transition-all duration-200 border
          ${
            isDark
              ? "bg-slate-800/80 border-slate-700 hover:border-slate-600 text-white"
              : "bg-white border-slate-300 hover:border-slate-400 text-slate-900"
          }
          ${isOpen ? "ring-2 ring-cyan-500/50" : ""}
        `}
      >
        {/* <Globe
          size={16}
          className={isDark ? "text-cyan-400" : "text-cyan-600"}
        /> */}
        <span className="text-lg">{selected.flag}</span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute top-full -left-30   mt-2 w-56 rounded-xl shadow-2xl border overflow-hidden z-50 animate-dropdown
            ${
              isDark
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-slate-200"
            }
          `}
        >
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleSelect(language)}
                className={`w-full flex items-center justify-between px-4 py-3 transition-all duration-150
                  ${
                    selected.code === language.code
                      ? isDark
                        ? "bg-cyan-600/20 text-cyan-400"
                        : "bg-cyan-50 text-cyan-600"
                      : isDark
                      ? "hover:bg-slate-700/50 text-slate-200"
                      : "hover:bg-slate-50 text-slate-700"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{language.flag}</span>
                  <span className="text-sm font-medium">{language.name}</span>
                </div>
                {selected.code === language.code && (
                  <Check size={16} className="text-cyan-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes dropdown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-dropdown {
          animation: dropdown 0.2s ease-out;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${
            isDark ? "rgba(100, 116, 139, 0.5)" : "rgba(148, 163, 184, 0.5)"
          };
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${
            isDark ? "rgba(100, 116, 139, 0.7)" : "rgba(148, 163, 184, 0.7)"
          };
        }
      `}</style>
    </div>
  );
};

export default LanguageDropdown;
