import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import { users } from "../../../../packages/db/schema.js";

// Fase 5 — Auth helpers: JWT + bcrypt. Neon first, in-memory fallback.

const JWT_SECRET = process.env.JWT_SECRET ?? "meeting-base-dev-secret-change-in-prod";
const JWT_EXPIRES = "7d";

export interface AuthUser {
  id: string;
  congregationId: string;
  email: string;
  nombre: string;
  rol: string;
}

interface StoredUser extends AuthUser {
  passwordHash: string;
}

// In-memory fallback (quando não há DATABASE_URL)
const memUsers = new Map<string, StoredUser>();

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, congregationId: user.congregationId, email: user.email, rol: user.rol },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      sub: string;
      congregationId: string;
      email: string;
      rol: string;
    };
    return {
      id: payload.sub,
      congregationId: payload.congregationId,
      email: payload.email,
      nombre: "",
      rol: payload.rol,
    };
  } catch {
    return null;
  }
}

async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const e = email.toLowerCase();
  // Neon first
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db.select().from(users).where(eq(users.email, e));
        const r = rows[0];
        if (r) {
          return {
            id: r.id,
            congregationId: r.congregationId,
            email: r.email,
            nombre: r.nombre,
            rol: r.rol,
            passwordHash: r.passwordHash,
          };
        }
      }
    } catch {
      // fallback to memory
    }
  }
  return memUsers.get(e);
}

export async function registerUser(
  email: string,
  password: string,
  nombre: string,
  congregationId: string,
  rol = "publicador"
): Promise<AuthUser> {
  const e = email.toLowerCase();
  const existing = await findUserByEmail(e);
  if (existing) throw new Error("Ya existe un usuario con ese email");

  const id = randomUUID();
  const passwordHash = await hashPassword(password);

  // Neon first
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.insert(users).values({
          id,
          congregationId,
          email: e,
          nombre,
          rol,
          passwordHash,
        });
        return { id, congregationId, email: e, nombre, rol };
      }
    } catch {
      // fallback to memory
    }
  }

  // In-memory fallback
  const user: StoredUser = {
    id,
    congregationId,
    email: e,
    nombre,
    rol,
    passwordHash,
  };
  memUsers.set(e, user);
  return { id, congregationId, email: e, nombre, rol };
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ user: AuthUser; token: string }> {
  const stored = await findUserByEmail(email);
  if (!stored) throw new Error("Email o contraseña incorrectos");

  const valid = await comparePassword(password, stored.passwordHash);
  if (!valid) throw new Error("Email o contraseña incorrectos");

  const user: AuthUser = {
    id: stored.id,
    congregationId: stored.congregationId,
    email: stored.email,
    nombre: stored.nombre,
    rol: stored.rol,
  };
  return { user, token: signToken(user) };
}

// Seed admin for dev (congregation 00000000-...)
export async function seedAdmin(): Promise<void> {
  const email = "admin@meeting-base.local";
  const existing = await findUserByEmail(email);
  if (existing) return;
  await registerUser(
    email,
    "admin123",
    "Administrador",
    "00000000-0000-0000-0000-000000000000",
    "admin"
  );
}
