// Server-only Google Sheets gateway client.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

function headers() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
    "Content-Type": "application/json",
  };
}

export async function createSpreadsheet(title: string): Promise<string> {
  const res = await fetch(`${GATEWAY_URL}/spreadsheets`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: "Registrations" } },
        { properties: { title: "Bills" } },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets create failed [${res.status}]: ${JSON.stringify(data)}`);
  return data.spreadsheetId as string;
}

export async function appendRow(spreadsheetId: string, sheet: string, row: (string | number)[]) {
  const url = `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${sheet}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ values: [row] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets append failed [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

export async function ensureHeaders(spreadsheetId: string) {
  // best-effort: write headers if rows are empty
  const checkAndWrite = async (sheet: string, headersRow: string[]) => {
    const res = await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${sheet}!A1:Z1`, {
      headers: headers(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Sheets read failed [${res.status}]: ${JSON.stringify(data)}`);
    if (!data.values || data.values.length === 0) {
      await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${sheet}!A1?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ values: [headersRow] }),
      });
    }
  };
  await checkAndWrite("Registrations", [
    "Timestamp", "Session ID", "Customer Name", "Mobile", "Tables",
    "Adults", "Kids", "Adult Rate", "Kid Rate", "Subsequent Rate", "Staff",
  ]);
  await checkAndWrite("Bills", [
    "Timestamp", "Session ID", "Customer Name", "Mobile", "Tables",
    "Started", "Ended", "Duration (min)", "Subtotal", "Total",
  ]);
}
