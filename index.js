import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(bodyParser.json());

// ***** CORS CONFIG *****
const allowedOrigins = [
  "https://ai-logistics-booking.gwcdata.ai",
  "http://localhost:3001",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Postman / server-side requests
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);

// ===== CONFIG =====
// Replace these with your real values from Zoom App Marketplace
const ACCOUNT_ID = "lLaWyWQnTeu3Xs5aUqijJg";
const AUTH_HEADER = "Basic WWMwZE5aeFBRSWl2aFIxU09hVnRkdzprWGNhWHhyaHgyTkFQQlFUZDh5bXRyVERyM0p5QjVqdQ=="; 
// Example: Basic bXlDbGllbnRJRDpteUNsaWVudFNlY3JldA==

// ===== ROUTE TO GET ACCESS TOKEN =====
app.get("/zoom/token", async (req, res) => {
  try {
    const params = new URLSearchParams();
    params.append("grant_type", "account_credentials");
    params.append("account_id", ACCOUNT_ID);

    const response = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        Authorization: AUTH_HEADER,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });

    const data = await response.json();

    if (response.ok) {
      return res.json(data); // { access_token, token_type, expires_in }
    } else {
      console.error("Zoom Error:", data);
      return res.status(response.status).json(data);
    }
  } catch (err) {
    console.error("Zoom Auth Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.post("/zoom/register", async (req, res) => {
  try {
    const {formData, token, meeting_id} = req.body; // coming from frontend form

    const payload = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.mobileNumber,
      industry: formData.industry,
      job_title: formData.jobTitle,
      org: formData.organization,
      custom_questions: [
        {
          title: "purposeForJoining",
          value: formData.purposeForJoining
        },
      ],
      auto_approve: true,
    };

    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${meeting_id}/registrants`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (response.ok) {
      return res.json(result);
    } else {
      console.error("Zoom Error:", result);
      return res.status(response.status).json(result);
    }
  } catch (error) {
    console.error("Zoom Registration Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// ===== START SERVER =====
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Zoom Server-to-Server OAuth running on port ${PORT}`);
});
