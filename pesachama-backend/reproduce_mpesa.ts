const consumerKey = "nBmLvdWI8Hs8L0Mx1jvttkCq4tcs7wmBdYkRDBGX5X2ve9RW";
const consumerSecret =
    "mCneDHOXPHRCe9llIYzOr9c6yw9EGrAiWkl8jXBDUYTljqyA6XUozw2UHHdX8Gi0";
const passkey =
    "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const shortcode = "174379";
const mpesaEnv: "sandbox" | "production" = "sandbox";

async function testMpesa() {
    console.log("Starting M-Pesa Test...");
    const baseUrl = mpesaEnv === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    // A. Get Access Token
    console.log("1. Authenticating...");
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    try {
        const authResp = await fetch(
            `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
            {
                headers: { Authorization: `Basic ${auth}` },
            },
        );

        if (!authResp.ok) {
            const errorText = await authResp.text();
            console.error("M-Pesa Auth Error:", errorText);
            throw new Error("Failed to authenticate with M-Pesa");
        }

        const { access_token } = await authResp.json();
        console.log(
            "   Auth Success! Token:",
            access_token.substring(0, 10) + "...",
        );

        // B. Generate Password & Timestamp
        const date = new Date();
        const timestamp = date.getFullYear().toString() +
            (date.getMonth() + 1).toString().padStart(2, "0") +
            date.getDate().toString().padStart(2, "0") +
            date.getHours().toString().padStart(2, "0") +
            date.getMinutes().toString().padStart(2, "0") +
            date.getSeconds().toString().padStart(2, "0");

        const password = btoa(`${shortcode}${passkey}${timestamp}`);

        // C. Send STK Push Request
        const phoneNumber = "254712345678"; // Test number
        const callbackUrl = "https://example.com/callback"; // Dummy callback

        const stkPayload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: 1,
            PartyA: phoneNumber,
            PartyB: shortcode,
            PhoneNumber: phoneNumber,
            CallBackURL: callbackUrl,
            AccountReference: "RatibuTest",
            TransactionDesc: "Test Deposit",
        };

        console.log("2. Sending STK Push...");
        const stkResp = await fetch(
            `${baseUrl}/mpesa/stkpush/v1/processrequest`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(stkPayload),
            },
        );

        const stkData = await stkResp.json();
        console.log("   STK Push Response:", JSON.stringify(stkData, null, 2));

        if (stkData.ResponseCode !== "0") {
            throw new Error(stkData.errorMessage || "M-Pesa STK Push Failed");
        }

        console.log("\n✅ Test Passed!");
    } catch (err) {
        console.error("\n❌ Test Failed:", err);
    }
}

testMpesa();
