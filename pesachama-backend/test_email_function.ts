/**
 * Test script to trigger the send-email Edge Function.
 * Run this locally using:
 * npx supabase functions serve send-email --env-file .env
 * Then in another terminal:
 * deno run --allow-net test_email_function.ts
 */

const FUNCTION_URL = "http://localhost:54321/functions/v1/send-email";

async function testEmail() {
  console.log("Testing Email Function...");

  const payload = {
    to: "RECEIVER_EMAIL_HERE@example.com", // Replace with your test recipient
    subject: "Test from Ratibu Neobank",
    body: "This is a test email sent from the newly created Supabase Edge Function.",
    html: "<h1>Ratibu Test</h1><p>This is a <b>test email</b> sent from the newly created Supabase Edge Function.</p>",
  };

  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("Response:", result);
  } catch (error) {
    console.error("Error calling function:", error);
  }
}

testEmail();
