import {describe,expect,it} from "vitest";
import {createInitialState} from "../domain/state";
import {scenarioEventInputs} from "./demo";

describe("simulation fixture provenance",()=>{
  it("labels session gate and synthesis as deterministic fixture output",()=>{
    const inputs=scenarioEventInputs(
      "Explore a better interface.",
      "council",
      "happy",
      createInitialState()
    );

    const started=inputs.find(input=>input.kind==="session.started");
    const gate=inputs.find(input=>input.kind==="gate.scored");
    const synthesis=inputs.find(input=>input.kind==="synthesis.completed");

    expect(started?.message).toMatch(/SIMULATION FIXTURE/i);
    expect(started?.message).toMatch(/No live provider execution/i);
    expect(gate?.message).toMatch(/SIMULATION FIXTURE SCORE 0\.88/i);
    expect(gate?.message).toMatch(/not live evidence/i);
    expect(synthesis?.message).toMatch(/SIMULATION FIXTURE/i);
    expect(synthesis?.message).toMatch(/Not live-provider evidence/i);
  });

  it("labels simulated role utterances as fixture output",()=>{
    const inputs=scenarioEventInputs(
      "Dream something.",
      "dream",
      "happy",
      createInitialState()
    );
    const utterance=inputs.find(input=>input.kind==="utterance.complete");
    expect(utterance?.source).toBe("simulator");
    expect(utterance?.message).toMatch(/^SIMULATION FIXTURE/);
  });
});
