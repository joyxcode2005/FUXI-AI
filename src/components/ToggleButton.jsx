const ToggleButton = ({ isDark, onChange, enabled }) => {
  return (
    <label className="relative flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={enabled}
        className="sr-only peer"
        onChange={onChange}
      />
      <div
        className={`relative w-10 h-6 bg-gray-200 hover:bg-gray-300 peer-focus:outline-0 rounded-full peer transition-all ease-in-out duration-500
        ${
          !isDark
            ? "peer-checked:bg-slate-900 hover:peer-checked:bg-slate-900"
            : "peer-checked:bg-yellow-400 hover:peer-checked:bg-yellow-500"
        }
        `}
      >
        {/* Sliding circle */}
        <div
          className={`absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-5 w-5 transition-all duration-500
          ${enabled ? "translate-x-4" : "translate-x-0"}
          `}
        />

        {/* Text inside toggle */}
        <span
          className={`absolute inset-0 z-1 flex items-center justify-center text-[9px] font-bold tracking-wide transition-all duration-500
          ${enabled ? (isDark ? "text-black" : "text-yellow-500") : "text-gray-400"}
          `}
        >
          AUTO
        </span>
      </div>
    </label>
  );
};

export default ToggleButton;
