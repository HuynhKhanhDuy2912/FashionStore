import axios from "axios";

const PAYPAL_API = process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

const getAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal configuration is missing");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const response = await axios.post(
      `${PAYPAL_API}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    return response.data.access_token;
  } catch (error) {
    throw new Error("Failed to get PayPal access token");
  }
};

export const createPayPalOrder = async (orderId, amount, currency = "USD") => {
  const accessToken = await getAccessToken();
  const returnUrl = process.env.PAYPAL_RETURN_URL || "http://localhost:5000/api/payment/paypal/callback";
  const cancelUrl = process.env.PAYPAL_CANCEL_URL || "http://localhost:3000/payment/failed";

  try {
    const response = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: orderId,
            amount: {
              currency_code: currency,
              value: amount.toFixed(2)
            }
          }
        ],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          brand_name: "FashionStore",
          landing_page: "NO_PREFERENCE",
          user_action: "PAY_NOW"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "PayPal order creation failed");
  }
};

export const capturePayPalOrder = async (paypalOrderId) => {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "PayPal capture failed");
  }
};

export const getPayPalOrderDetails = async (paypalOrderId) => {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.get(
      `${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
  } catch (error) {
    throw new Error("Failed to get PayPal order details");
  }
};
