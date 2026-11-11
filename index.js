const functions = require("@google-cloud/functions-framework");
const fs = require("fs");
const path = require("path");

// --- API KEY & CONFIGURATION ---
function getApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const envPaths = [
    path.join(__dirname, ".env"),
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "API KEy.txt"),
    path.join(__dirname, "..", "API KEy.txt"),
    "C:\\Users\\Nadeem Akram\\Desktop\\Angular Project\\myapp\\sabrina-agents\\.env"
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf8");
      const match = content.match(/GEMINI_API_KEY=([^\r\n]+)/);
      if (match) return match[1].trim();
      return content.trim();
    }
  }
  return "";
}

const MODEL_QUEUE = [
  process.env.GEMINI_MODEL,
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash"
].filter(Boolean);

const MAX_LOOPS = 5;

// --- GOOGLE GEMINI LLM CALL ---
async function callLLM(agentName, messages, apiKey) {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set. Please provide it in environment variables or request.");
  }

  let systemInstruction = undefined;
  const contents = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemInstruction = { parts: [{ text: m.content }] };
    } else {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      });
    }
  }

  if (contents.length === 0 || contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "Begin your task." }] });
  }

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.2,
      stopSequences: ["Observation:"]
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = systemInstruction;
  }

  let lastError = null;
  for (const model of MODEL_QUEUE) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(`[${agentName}] Gemini [${model}] error (${res.status}): ${errText}`);
        continue;
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) {
        lastError = new Error(`[${agentName}] Gemini [${model}] returned no text: ${JSON.stringify(data)}`);
        continue;
      }
      return reply.trim();
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error(`[${agentName}] Failed to generate content from all Gemini models.`);
}

// --- AGENT FACTORY ---
function createAgent({ name, role, tools, task, outputKey }) {
  const systemPrompt = `${role}

You run in a loop of Thought, Action, Observation.
Available tools:
${Object.entries(tools).map(([toolName, tool]) => `- ${toolName}: ${tool.description}`).join("\n")}

To use a tool, respond EXACTLY like this, then stop and wait for the Observation:
Thought: <your reasoning>
Action: <tool name>
Action Input: <tool input>

When you are done, respond EXACTLY like this:
Thought: <your reasoning>
Final Answer: <your answer>`;

  async function run(state, apiKey) {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: task(state) },
    ];

    for (let loop = 1; loop <= MAX_LOOPS; loop++) {
      console.log(`-> [${name}] Turn ${loop} reasoning...`);
      const llmOutput = await callLLM(name, messages, apiKey);
      messages.push({ role: "assistant", content: llmOutput });

      const finalAnswer = llmOutput.match(/Final Answer:\s*([\s\S]*)/i);
      if (finalAnswer) {
        console.log(`   [${name}] Final answer completed.`);
        return finalAnswer[1].trim();
      }

      const action = llmOutput.match(/Action:\s*([^\r\n]+)[\r\n]+(?:Action )?Input:\s*([^\r\n]+)/i);
      if (action) {
        const toolName = action[1].trim();
        const toolInput = action[2].trim();
        const tool = tools[toolName];
        console.log(`   [${name}] Calling tool: ${toolName}("${toolInput}")`);
        const observation = tool
          ? await tool.run(toolInput)
          : `Tool "${toolName}" not found. Available tools: ${Object.keys(tools).join(", ")}`;
        messages.push({ role: "user", content: `Observation: ${observation}` });
      } else {
        messages.push({ role: "user", content: "Observation: Please output Action: <tool> and Action Input: <input>, or Final Answer: <answer>" });
      }
    }
    throw new Error(`${name} did not finish within ${MAX_LOOPS} loops.`);
  }

  return { name, outputKey, run };
}

// --- PARALLEL AGENTS ---
const interestMatcher = createAgent({
  name: "Interest Matcher",
  role: "You are an interest matcher. Find careers that match the user's likes and interests. Do not worry about anything else.",
  task: (state) => `My likes and dislikes: ${state.userInput}`,
  outputKey: "interests",
  tools: {
    search_careers: {
      description: "Finds careers that match a list of interests. Input: comma-separated interests.",
      run: async (interests) => `Careers matching "${interests}": Wildlife Biologist, Veterinarian, Park Ranger, Lab Researcher.`,
    },
  },
});

const workStyleAnalyst = createAgent({
  name: "Work Style Analyst",
  role: "You are a work style analyst. Find careers whose day-to-day work avoids what the user dislikes. Do not worry about anything else.",
  task: (state) => `My likes and dislikes: ${state.userInput}`,
  outputKey: "workStyle",
  tools: {
    find_careers_by_work_style: {
      description: "Finds careers by typical work setting. Input: comma-separated work styles, e.g. 'outdoor, active' or 'office'.",
      run: async (styles) => `Careers with "${styles}" work: Wildlife Biologist, Park Ranger, Forester, Veterinarian (clinic and field).`,
    },
  },
});

const jobMarketAnalyst = createAgent({
  name: "Job Market Analyst",
  role: "You are a job market analyst. Report on demand and growth for careers in the user's fields of interest. Do not worry about anything else.",
  task: (state) => `My likes and dislikes: ${state.userInput}`,
  outputKey: "jobMarket",
  tools: {
    get_job_outlook: {
      description: "Looks up job growth for careers in a field. Input: comma-separated fields.",
      run: async (fields) =>
        `Outlook for "${fields}": Veterinarian +19% (much faster than average); ` +
        "Wildlife Biologist +3% (average, competitive); Park Ranger +2% (slow).",
    },
  },
});

const careerAdvisor = createAgent({
  name: "Career Advisor",
  role:
    "You are a career advisor. You receive reports from three specialists. Choose the ONE best career, " +
    "say why, then explain how to get there: school, certifications, experience, and timeline.",
  task: (state) =>
    `User's likes and dislikes: ${state.userInput}\n\n` +
    `Interest Matcher report: ${state.interests}\n` +
    `Work Style Analyst report: ${state.workStyle}\n` +
    `Job Market Analyst report: ${state.jobMarket}`,
  outputKey: "plan",
  tools: {
    get_career_requirements: {
      description: "Looks up the schooling, certifications, and experience needed for a career. Input: a career name.",
      run: async (career) =>
        `${career}: Bachelor's in Biology/Zoology/Wildlife Science; Master's for research roles; ` +
        "Associate Wildlife Biologist cert (The Wildlife Society); field technician experience.",
    },
  },
});

// --- PARALLEL ORCHESTRATOR ---
async function runParallel(agents, state, apiKey) {
  const results = await Promise.all(agents.map((agent) => agent.run(state, apiKey)));
  agents.forEach((agent, i) => (state[agent.outputKey] = results[i]));
  return state;
}

async function runCareerSystem(userInput, apiKey) {
  const state = { userInput };
  await runParallel([interestMatcher, workStyleAnalyst, jobMarketAnalyst], state, apiKey);
  state[careerAdvisor.outputKey] = await careerAdvisor.run(state, apiKey);
  return state;
}

// --- GOOGLE CLOUD FUNCTION HANDLER ---
async function handleRequest(req, res) {
  // Handle CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  // Health check / GET info
  if (req.method === "GET") {
    return res.status(200).json({
      status: "online",
      message: "Career Parallel Multi-Agent API is running on Google Cloud!",
      usage: "Send a POST request with JSON: { \"userInput\": \"Your interests...\" }"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Please use POST." });
  }

  try {
    const body = req.body || {};
    const userInput = body.userInput;
    const apiKey = body.apiKey || req.headers["x-api-key"] || getApiKey();

    if (!userInput || typeof userInput !== "string" || userInput.trim() === "") {
      return res.status(400).json({
        error: "Missing or invalid 'userInput'. Please send JSON body: { \"userInput\": \"your text here\" }"
      });
    }

    const result = await runCareerSystem(userInput.trim(), apiKey);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        userInput: result.userInput,
        interests: result.interests,
        workStyle: result.workStyle,
        jobMarket: result.jobMarket,
        plan: result.plan
      }
    });
  } catch (err) {
    console.error("Agent execution error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An error occurred while executing the multi-agent system."
    });
  }
}

// Register Google Cloud Functions HTTP target
functions.http("careerAdvisor", handleRequest);

// Export for Cloud Function and module usage
module.exports = {
  careerAdvisor: handleRequest,
  runCareerSystem
};
