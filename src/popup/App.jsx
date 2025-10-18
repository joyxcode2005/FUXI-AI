import "./App.css";

export default function App() {
  
  const handleSearch = () => {
    chrome.tabs.create({
      url: "https://www.google.com/search?q=punkifiedayush",
    });
  };

  return (
    <div className="w-50 flex p-[1rem] flex-col items-center">
      <h3>Quick Google Search</h3>
      <button
        onClick={handleSearch}
        className="px-[0.5rem] py-[1rem] rounded-[8px] border-none bg-[#4285F4] text-white cursor-pointer"
      >
        Search "Sundar Pichai"
      </button>
    </div>
  );
}
