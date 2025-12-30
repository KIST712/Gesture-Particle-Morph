export enum GestureType {
  RESET = 'RESET', // Fist (0 fingers)
  ONE = 'ONE',     // 1 finger
  TWO = 'TWO',     // 2 fingers
  THREE = 'THREE', // 3 fingers
  LOVE = 'LOVE'    // 5 fingers (Open hand)
}

export interface HandState {
  gesture: GestureType;
  isTracking: boolean;
}