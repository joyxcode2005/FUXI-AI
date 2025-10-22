

const Button = ({ disabled, isDark, onClick, text, icon: Icon }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2 px-1 text-[10px] flex items-center gap-2 justify-center font-semibold rounded-xl transition-all ${
        isDark
          ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
          : "bg-white/80 hover:bg-white text-slate-700 border border-indigo-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-md cursor-pointer"}`}
    >
      {Icon && <Icon className="w-4 h-4 mr-1 inline-block" />}
      <span>{text}</span>
    </button>
  );
};

export default Button;
