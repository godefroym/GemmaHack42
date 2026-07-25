export interface ReplayState {
  cursor: number;
  playing: boolean;
}

export type ReplayAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "goto"; index: number };

export const initialReplay: ReplayState = { cursor: 0, playing: false };

const clamp = (n: number, len: number) => Math.max(0, Math.min(len, n));

export function replayReducer(
  state: ReplayState,
  action: ReplayAction,
  length: number,
): ReplayState {
  switch (action.type) {
    case "play":
      return state.cursor >= length ? { cursor: 0, playing: true } : { ...state, playing: true };
    case "pause":
      return { ...state, playing: false };
    case "reset":
      return { cursor: 0, playing: false };
    case "next": {
      const cursor = clamp(state.cursor + 1, length);
      return { cursor, playing: cursor >= length ? false : state.playing };
    }
    case "prev":
      return { ...state, cursor: clamp(state.cursor - 1, length) };
    case "goto":
      return { ...state, cursor: clamp(action.index, length) };
    default:
      return state;
  }
}
