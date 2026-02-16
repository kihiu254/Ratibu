export const FeaturePhone = () => {
  return (
    <div className="relative w-[180px] h-[360px] bg-gray-900 rounded-[30px] border-4 border-gray-800 shadow-2xl flex flex-col items-center justify-between p-4 transform rotate-[-10deg] hover:rotate-0 transition-all duration-500">
      <div className="w-12 h-1.5 bg-gray-700 rounded-full mb-2"></div>
      <div className="w-full h-[140px] bg-[#a8c64e] border-4 border-gray-700 rounded-md overflow-hidden relative shadow-inner">
        <div className="p-2 font-mono text-[10px] leading-tight text-black font-bold">
          <div className="flex justify-between border-b border-black/20 pb-1 mb-1">
            <span>PesaChama</span>
            <span>BAT: 80%</span>
          </div>
          <div className="space-y-1">
            <div>1. Send Money</div>
            <div>2. Withdraw</div>
            <div>3. Loans</div>
            <div>4. My Account</div>
          </div>
          <div className="absolute bottom-1 right-2 animate-pulse">_</div>
        </div>
      </div>
      <div className="text-gray-500 text-[10px] font-bold tracking-widest my-1">NOKIA</div>
      <div className="grid grid-cols-3 gap-2 w-full mb-4">
        <div className="col-span-3 flex justify-between px-2 mb-1">
          <div className="w-8 h-3 bg-gray-700 rounded-sm"></div>
          <div className="w-8 h-8 bg-gray-700 rounded-full -mt-2 border-2 border-gray-600"></div>
          <div className="w-8 h-3 bg-gray-700 rounded-sm"></div>
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((key) => (
          <div key={key} className="h-6 bg-gray-800 rounded-sm flex items-center justify-center text-white text-xs font-bold shadow-sm border-b-2 border-gray-950">
            {key}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SmartPhone = () => {
  return (
    <div className="relative w-[200px] h-[400px] bg-black rounded-[35px] border-[6px] border-gray-800 shadow-2xl overflow-hidden transform rotate-[10deg] hover:rotate-0 transition-all duration-500">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-xl z-20"></div>
      <div className="w-full h-full bg-white flex flex-col">
        <div className="h-6 bg-[#0B2545] w-full"></div>
        <div className="h-14 bg-[#0B2545] flex items-center justify-between px-4 text-white">
          <div className="w-6 h-6 bg-white/20 rounded-full"></div>
          <span className="font-semibold text-sm">Hello, John</span>
          <div className="w-6 h-6 bg-white/20 rounded-full"></div>
        </div>
        <div className="p-4">
          <div className="bg-gradient-to-r from-[#00B87C] to-[#009f6b] rounded-xl p-4 text-white shadow-lg">
            <div className="text-[10px] opacity-80 mb-1">Total Savings</div>
            <div className="text-xl font-bold">KES 45,000</div>
            <div className="flex gap-2 mt-3">
              <div className="h-6 w-16 bg-white/20 rounded-md"></div>
              <div className="h-6 w-16 bg-white/20 rounded-md"></div>
            </div>
          </div>
        </div>
        <div className="px-4 grid grid-cols-4 gap-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-gray-300 rounded-sm"></div>
              </div>
              <div className="w-8 h-1.5 bg-gray-200 rounded-full"></div>
            </div>
          ))}
        </div>
        <div className="mt-4 px-4 space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center gap-3 p-2 border border-gray-100 rounded-lg">
              <div className="w-8 h-8 bg-orange-100 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <div className="w-20 h-2 bg-gray-200 rounded-full"></div>
                <div className="w-12 h-1.5 bg-gray-100 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto h-12 border-t border-gray-100 flex items-center justify-around px-2">
          <div className="w-6 h-6 bg-[#00B87C] rounded-full"></div>
          <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
          <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};
