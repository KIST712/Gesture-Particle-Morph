import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureType, HandState } from '../types';

interface HandManagerProps {
  onHandUpdate: (state: HandState) => void;
}

const HandManager: React.FC<HandManagerProps> = ({ onHandUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const [debugMsg, setDebugMsg] = useState<string>("Initializing AI...");
  
  // Smoothing Buffer
  // Reduced buffer size to 3 for faster response while maintaining basic jitter protection
  const gestureBuffer = useRef<GestureType[]>([]);
  const BUFFER_SIZE = 3; 
  const lastEmittedGesture = useRef<GestureType>(GestureType.RESET);

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5, // Slightly lower tracking confidence allows for faster recovery during fast motion
          minHandPresenceConfidence: 0.6,
        });

        setDebugMsg("Starting Camera...");
        startWebcam();
      } catch (error) {
        console.error(error);
        setDebugMsg("AI Init Failed");
      }
    };

    initMediaPipe();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(requestRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startWebcam = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            facingMode: "user",
            frameRate: { ideal: 60 }
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Play error:", e));
          setDebugMsg("");
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setDebugMsg("Camera Denied/Error");
      }
    } else {
      setDebugMsg("Camera not supported");
    }
  };

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current) return;

    if (videoRef.current.readyState >= 2) {
      let startTimeMs = performance.now();
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
      
      let detectedGesture = GestureType.RESET; 
      const hands = results.landmarks.length;

      if (hands > 0) {
        const lm = results.landmarks[0];
        
        // Helper: Calculate squared distance between two landmarks
        const distSq = (p1: any, p2: any) => {
          return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
        };

        // 1. Calculate Palm Scale (Reference)
        // Distance from Wrist(0) to Index MCP(5) is a stable measure of hand size
        const palmScaleSq = distSq(lm[0], lm[5]);
        
        // 2. Finger States (Open vs Closed)
        // A finger is OPEN if the Tip is significantly further from the Wrist than the PIP joint is.
        // We use a small multiplier (1.1) to add a hysteresis buffer.
        const isFingerOpen = (tipIdx: number, pipIdx: number) => {
             return distSq(lm[0], lm[tipIdx]) > (distSq(lm[0], lm[pipIdx]) * 1.1);
        };

        const indexOpen = isFingerOpen(8, 6);
        const middleOpen = isFingerOpen(12, 10);
        const ringOpen = isFingerOpen(16, 14);
        const pinkyOpen = isFingerOpen(20, 18);

        // 3. Thumb State
        // Thumb is OPEN if the tip is far from the Index finger's base (MCP).
        // If thumb is tucked (closed), it's close to the Index MCP.
        const thumbTipToIdxMcp = distSq(lm[4], lm[5]);
        const thumbOpen = thumbTipToIdxMcp > (palmScaleSq * 0.6); 

        // 4. Strict Classification Rules
        // We now check explicitly for CLOSED fingers to distinguish gestures accurately.

        // --- FIVE (LOVE) ---
        // Condition: All fingers open.
        // Relaxed slightly: If 4 main fingers are open, it's likely 5 (thumb detection can vary).
        if (indexOpen && middleOpen && ringOpen && pinkyOpen) {
            detectedGesture = GestureType.LOVE;
        }

        // --- THREE ---
        // Case A: Standard 3 (Index + Middle + Ring). Pinky MUST be closed.
        else if (indexOpen && middleOpen && ringOpen && !pinkyOpen) {
            detectedGesture = GestureType.THREE;
        }
        // Case B: Euro 3 (Thumb + Index + Middle). Ring + Pinky MUST be closed.
        else if (thumbOpen && indexOpen && middleOpen && !ringOpen && !pinkyOpen) {
            detectedGesture = GestureType.THREE;
        }

        // --- TWO ---
        // Case A: Peace (Index + Middle). Ring + Pinky MUST be closed.
        // We don't care about thumb here (Peace sign often has thumb tucked or out).
        else if (indexOpen && middleOpen && !ringOpen && !pinkyOpen) {
            detectedGesture = GestureType.TWO;
        }
        // Case B: Gun/L-shape (Thumb + Index). Middle + Ring + Pinky MUST be closed.
        else if (thumbOpen && indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
            detectedGesture = GestureType.TWO;
        }

        // --- ONE ---
        // Index Open. Middle + Ring + Pinky MUST be closed.
        else if (indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
            detectedGesture = GestureType.ONE;
        }
        
        // Default
        else {
            detectedGesture = GestureType.RESET;
        }

      } else {
          detectedGesture = GestureType.RESET;
      }

      // --- Signal Smoothing (Debouncing) ---
      gestureBuffer.current.push(detectedGesture);
      if (gestureBuffer.current.length > BUFFER_SIZE) {
          gestureBuffer.current.shift();
      }

      // Mode calculation (Most frequent gesture in buffer)
      const counts: Record<string, number> = {};
      let maxCount = 0;
      let smoothGesture = lastEmittedGesture.current;

      gestureBuffer.current.forEach(g => {
          counts[g] = (counts[g] || 0) + 1;
          if (counts[g] > maxCount) {
              maxCount = counts[g];
              smoothGesture = g;
          }
      });

      // Threshold: The gesture must appear in more than half the frames in the buffer to trigger a change
      if (maxCount > BUFFER_SIZE / 2) {
          if (smoothGesture !== lastEmittedGesture.current) {
              lastEmittedGesture.current = smoothGesture;
              onHandUpdate({
                  gesture: smoothGesture,
                  isTracking: hands > 0
              });
          }
      }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedData={predictWebcam}
        style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            opacity: 0, 
            pointerEvents: 'none',
            zIndex: -1,
            width: 'auto',
            height: 'auto'
        }}
      />
      {debugMsg && (
        <div className="absolute bottom-4 left-4 text-white text-xs bg-black/50 p-2 rounded pointer-events-none">
          {debugMsg}
        </div>
      )}
    </>
  );
};

export default HandManager;