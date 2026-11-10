// Quick script to test the local or deployed API endpoint
const ENDPOINT = process.env.API_URL || "http://localhost:8080";

async function testApi() {
  console.log(`Sending request to: ${ENDPOINT}`);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userInput: "I love animals and science. I dislike sitting at a desk all day."
      })
    });

    const data = await res.json();
    console.log("\n=== RESPONSE FROM API ===");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

testApi();
