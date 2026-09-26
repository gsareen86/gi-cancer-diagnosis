import { readAISettings } from "../src/lib/ai/settings";
// Output only the identifier. Never serialize credentials from operator configuration.
console.log(readAISettings().provider);
