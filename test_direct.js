const { runCareerSystem } = require("./index");

async function main() {
  console.log("Starting Career Parallel Multi-Agent execution...");
  const start = Date.now();
  try {
    const res = await runCareerSystem("I love computers, artificial intelligence, and remote work");
    console.log(`Completed in ${((Date.now() - start) / 1000).toFixed(1)}s!`);
    console.log("\n=== RESULTS ===");
    console.log("Interests:", res.interests);
    console.log("Work Style:", res.workStyle);
    console.log("Job Market:", res.jobMarket);
    console.log("Career Plan:\n", res.plan);
  } catch (err) {
    console.error("Execution failed:", err);
  }
}

main();
