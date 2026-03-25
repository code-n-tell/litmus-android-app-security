import { createApiApp } from "./createApiApp.js";

const PORT = Number(process.env.API_PORT || 8787);

createApiApp().listen(PORT, () => {
  console.log(`API listening on http://127.0.0.1:${PORT}`);
});
