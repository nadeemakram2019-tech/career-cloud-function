const express = require("express");
const cors = require("cors");
const { careerAdvisor } = require("./index");

const app = express();
app.use(cors());
app.use(express.json());

// Forward requests to the handler
app.all("*", (req, res) => {
  careerAdvisor(req, res);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Career Multi-Agent API is running!`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Test with:`);
  console.log(`curl -X POST http://localhost:${PORT} -H "Content-Type: application/json" -d "{\\"userInput\\": \\"I love space and physics\\"}"`);
  console.log(`====================================================`);
});
