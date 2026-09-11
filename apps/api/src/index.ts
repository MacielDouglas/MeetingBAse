import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

// Carga apps/api/.env (ruta explícita: funciona desde cualquier cwd).
// Sin .env la API sigue en memoria con `persistencia: "memoria"`.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const app = await buildApp();
const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
