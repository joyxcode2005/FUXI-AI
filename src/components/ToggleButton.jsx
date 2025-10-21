const ToggleButton = ({ isDark, onChange, enabled }) => {
  return (
    <label class="relative flex items-center cursor-pointer">
      <input type="checkbox" checked={enabled} class="sr-only peer" onChange={onChange}  />
      <div
        className={`w-9 h-5 bg-gray-200 hover:bg-gray-300 peer-focus:outline-0  rounded-full peer transition-all ease-in-out duration-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all 
        ${
          !isDark
            ? "peer-checked:bg-slate-900 hover:peer-checked:bg-slate-900"
            : "peer-checked:bg-yellow-400 hover:peer-checked:bg-yellow-500 "
        }
        `}
      ></div>
      <span
        className={`ml-3 text-sm font-medium
        ${isDark ? "text-yellow-300" : "text-gray-800"}
        `}
      >
        Auto
      </span>
    </label>
  );
};

export default ToggleButton;
