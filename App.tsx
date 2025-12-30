import React, { useState } from 'react';
import HandManager from './components/HandManager';
import Experience from './components/Experience';
import { HandState, GestureType } from './types';

const App: React.FC = () => {
  const [handState, setHandState] = useState<HandState>({
    gesture: GestureType.RESET,
    isTracking: false
  });

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-black overflow-hidden font-sans select-none">
      {/* 3D Experience */}
      <Experience handState={handState} />

      {/* Logic Layer */}
      <HandManager onHandUpdate={setHandState} />

      {/* Minimal UI - Top Right Button Only */}
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={toggleFullScreen}
          className="bg-white/10 hover:bg-white/20 text-white/50 hover:text-white p-2 rounded-full transition-all backdrop-blur-sm"
          title="Toggle Fullscreen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
        </button>
      </div>

      {/* Optional: Very subtle hint if not tracking initially */}
      {!handState.isTracking && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/20 text-sm animate-pulse pointer-events-none">
          Show Hand to Start
        </div>
      )}
    </div>
  );
};

export default App;