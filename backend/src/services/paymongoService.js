const PAYMONGO_API_URL = process.env.PAYMONGO_API_URL || 'https://api.paymongo.com';

function paymongoHeaders() {
  const secretKey = String(process.env.PAYMONGO_SECRET_KEY || '').trim();
  if (!secretKey) {
    throw new Error('PayMongo is not configured. Set PAYMONGO_SECRET_KEY in backend/.env.');
  }

  return {
    Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
    'Content-Type': 'application/json',
  };
}

export async function createPayMongoCheckoutSession({ lineItems, referenceNumber, successUrl, cancelUrl }) {
  const response = await fetch(`${PAYMONGO_API_URL}/v2/checkout_sessions`, {
    method: 'POST',
    headers: paymongoHeaders(),
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: lineItems,
          payment_method_types: ['gcash', 'card', 'paymaya'],
          success_url: successUrl,
          cancel_url: cancelUrl,
          reference_number: referenceNumber,
          description: `Cocolytics order ${referenceNumber}`,
          show_line_items: true,
        },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.errors?.[0]?.detail || 'PayMongo checkout session could not be created.';
    throw new Error(detail);
  }

  const session = payload?.data;
  const checkoutUrl = session?.attributes?.checkout_url;
  if (!session?.id || !checkoutUrl) {
    throw new Error('PayMongo returned an incomplete checkout session.');
  }

  return {
    sessionId: session.id,
    checkoutUrl,
  };
}
