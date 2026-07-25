import { describe, it, expect } from "vitest";
import { replayReducer, initialReplay } from "./replay";

const LEN = 21;

describe("replayReducer", () => {
  it("advances and stops at the end, auto-pausing", () => {
    let s = initialReplay;
    for (let i = 0; i < 100; i++) s = replayReducer(s, { type: "next" }, LEN);
    expect(s.cursor).toBe(LEN);
    expect(s.playing).toBe(false);
  });

  it("never goes below zero", () => {
    let s = { cursor: 0, playing: false };
    s = replayReducer(s, { type: "prev" }, LEN);
    expect(s.cursor).toBe(0);
  });

  it("reset returns to the start and pauses", () => {
    const s = replayReducer({ cursor: 10, playing: true }, { type: "reset" }, LEN);
    expect(s).toEqual({ cursor: 0, playing: false });
  });

  it("goto clamps into range", () => {
    expect(replayReducer(initialReplay, { type: "goto", index: 999 }, LEN).cursor).toBe(LEN);
    expect(replayReducer(initialReplay, { type: "goto", index: -5 }, LEN).cursor).toBe(0);
  });
});
