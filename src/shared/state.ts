export interface GameState {
  timerValue: number;
  isKeyCollected: boolean;
  isDoorOpen: boolean;
}

export const createInitialState = (): GameState => ({
  timerValue: 0,
  isKeyCollected: false,
  isDoorOpen: false
});

export const updateTimer = (state: GameState, elapsedMs: number): GameState => {
  if (state.isDoorOpen) {
    return state;
  }

  return {
    ...state,
    timerValue: elapsedMs
  };
};

export const collectKey = (state: GameState): GameState => ({
  ...state,
  isKeyCollected: true
});

export const openDoor = (state: GameState): GameState => {
  if (!state.isKeyCollected) {
    return state;
  }

  return {
    ...state,
    isDoorOpen: true
  };
};
