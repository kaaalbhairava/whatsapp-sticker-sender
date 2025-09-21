export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  global.sending = false;
  return res.json({ status: "stopped" });
}
