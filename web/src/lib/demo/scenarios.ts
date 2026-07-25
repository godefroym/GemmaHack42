// The real case Gemma investigated on an isolated ransomware VM.
export interface Scenario {
  label: string;
  caseId: string;
  fixture: string;
  json: string;
}

export const CASE: Scenario = {
  label: "Hospital ransomware",
  caseId: "hospital-ransomware",
  fixture: "eval/fixtures/hospital-ransomware",
  json: "/demo/ransomware.json",
};

// The real endpoint the model was served from during the run (DGX Spark GB10).
export const MODEL = "gemma4:26b-fp8";
export const ENDPOINT = "http://dgx-spark:8010/v1";
