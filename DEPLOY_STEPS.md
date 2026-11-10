# Google Cloud Functions Deploy Guide (2 Minutes)

Aapka Multi-Agent system Google Cloud Functions ke liye bilkul tayyar hai (`career-cloud-function` folder mein).

---

## Method 1: Google Cloud Web Console (Sab se Aasan - No CLI needed)

1. Open karein: **[Google Cloud Functions Console](https://console.cloud.google.com/functions)**
2. Upar **"CREATE FUNCTION"** par click karein.
3. Settings select karein:
   - **Environment:** 2nd gen
   - **Function name:** `career-advisor`
   - **Region:** `us-central1` (ya koi bhi qareebi region)
   - **Trigger:** HTTPS
   - **Authentication:** Check karein **"Allow unauthenticated invocations"** (taake aap publicly call kar sakein).
4. **Runtime environment variables** section mein jayein:
   - Add variable:
     - Name: `GEMINI_API_KEY`
     - Value: Aapki Gemini API Key (jo `API KEy.txt` mein hai)
5. **NEXT** par click karein.
6. Code Screen par:
   - **Runtime:** `Node.js 20` (ya `Node.js 22`)
   - **Entry point:** `careerAdvisor`
   - Left side par do files hongi:
     - `index.js` -> Hamari `career-cloud-function/index.js` ka sara code copy kar ke yahan paste karein.
     - `package.json` -> Hamari `career-cloud-function/package.json` ka sara code copy kar ke paste karein.
7. Niche **"DEPLOY"** button daba dein!

Kuch seconds mein Google Cloud aapko ek HTTPS URL de dega jaise:
`https://career-advisor-xxxx-uc.a.run.app`

---

## Method 2: Google Cloud CLI (Agar gcloud install karein)

Agar terminal se deploy karna chahein:

```bash
# 1. Google Cloud CLI install karein aur login karein:
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. career-cloud-function folder mein jayein:
cd "career-cloud-function"

# 3. Deploy command chalayein:
gcloud functions deploy careerAdvisor \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=careerAdvisor \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="AAPKI_KEY"
```

---

## Call Kaise Karna Hai (Usage)

Deploy hone ke baad aap kisi bhi jagah se POST request bhej sakte hain:

### cURL:
```bash
curl -X POST https://YOUR_CLOUD_FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"userInput": "I love computers, artificial intelligence, and remote work"}'
```

### JavaScript / Frontend:
```javascript
const response = await fetch("https://YOUR_CLOUD_FUNCTION_URL", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userInput: "I love animals and science, hate desk jobs"
  })
});
const data = await response.json();
console.log(data.data.plan);
```
