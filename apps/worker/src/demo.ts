import { runWorkerOnce } from "./index";

const result = await runWorkerOnce();
console.log(`Worker once complete: ${result}`);
