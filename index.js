import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import cookieParser from "cookie-parser";
import ExcelJS from "exceljs";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const allowedOrigins = [
  "https://ai-logistics-booking.gwcdata.ai",
  "http://localhost:8080",
  "http://localhost:3001",
  "http://127.0.0.1:8080",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());

// ===== CONFIG =====
const ACCOUNT_ID = "lLaWyWQnTeu3Xs5aUqijJg";
const AUTH_HEADER =
  "Basic WWMwZE5aeFBRSWl2aFIxU09hVnRkdzprWGNhWHhyaHgyTkFQQlFUZDh5bXRyVERyM0p5QjVqdQ==";

// ===== ROUTE TO GET ACCESS TOKEN =====
const getZoomAccessToken = async () => {
  const params = new URLSearchParams();
  params.append("grant_type", "account_credentials");
  params.append("account_id", ACCOUNT_ID);

  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: AUTH_HEADER,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = await response.json();

  if (response.ok) {
    return data;
  } else {
    throw new Error(JSON.stringify(data));
  }
};

// ===== ROUTE TO GET ACCESS TOKEN =====
app.get("/zoom/token", async (req, res) => {
  try {
    const data = await getZoomAccessToken();
    return res.json(data);
  } catch (err) {
    console.error("Zoom Auth Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/zoom/register", async (req, res) => {
  try {
    const { formData, token, meeting_id } = req.body; // coming from frontend form

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
          value: formData.purposeForJoining,
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

app.get("/zoom/get-registrants", async (req, res) => {
  try {
    const meeting_id = "84054283097";

    const token = await getZoomAccessToken();
    const access_token = token.access_token;

    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${meeting_id}/registrants`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      const registrants = data.registrants || [];

      // Create Excel Workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Registrants");

      // Define Columns
      worksheet.columns = [
        { header: "First Name", key: "first_name", width: 20 },
        { header: "Last Name", key: "last_name", width: 20 },
        { header: "Email", key: "email", width: 30 },
        { header: "Job Title", key: "job_title", width: 25 },
        { header: "Organization", key: "org", width: 25 },
        { header: "Industry", key: "industry", width: 20 },
        { header: "Mobile", key: "phone", width: 15 },
        { header: "Purpose", key: "purpose", width: 40 },
        { header: "Created At", key: "create_time", width: 25 },
      ];

      // Add Data
      registrants.forEach((reg) => {
        // Find custom question for Purpose if exists
        const purposeQ = reg.custom_questions?.find(
          (q) => q.title === "purposeForJoining"
        );

        worksheet.addRow({
          first_name: reg.first_name,
          last_name: reg.last_name,
          email: reg.email,
          job_title: reg.job_title,
          org: reg.org,
          industry: reg.industry,
          phone: reg.phone,
          purpose: purposeQ ? purposeQ.value : "",
          create_time: reg.create_time,
        });
      });

      // Style Header
      worksheet.getRow(1).font = { bold: true };

      // Set Response Headers
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=" + `registrants-${meeting_id}.xlsx`
      );

      // Write to Response
      await workbook.xlsx.write(res);
      res.end();
    } else {
      return res.status(response.status).json(data);
    }
  } catch (error) {
    console.error("Zoom registrants fetch error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

// ===== START SERVER =====
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Zoom Server-to-Server OAuth running on port ${PORT}`);
});
