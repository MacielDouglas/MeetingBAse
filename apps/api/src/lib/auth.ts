import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import { users, congregations } from "../../../../packages/db/schema.js";

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

// ---------- Congregations ----------

export interface CongregationInfo {
  id: string;
  nombre: string;
  numero: string | null;
  circuito: string | null;
  timezone: string;
}

const memCongregations = new Map<string, CongregationInfo>();

export async function listCongregations(): Promise<CongregationInfo[]> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db.select().from(congregations);
        return rows.map((r) => ({
          id: r.id,
          nombre: r.nombre,
          numero: r.numero,
          circuito: r.circuito,
          timezone: r.timezone,
        }));
      }
    } catch {
      // fallback to memory
    }
  }
  return [...memCongregations.values()];
}

export async function createCongregation(
  nombre: string,
  numero?: string,
  circuito?: string,
  timezone = "America/Santiago"
): Promise<CongregationInfo> {
  const id = randomUUID();

  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.insert(congregations).values({
          id,
          nombre,
          numero: numero ?? null,
          circuito: circuito ?? null,
          timezone,
        });
        return { id, nombre, numero: numero ?? null, circuito: circuito ?? null, timezone };
      }
    } catch {
      // fallback to memory
    }
  }

  const cong: CongregationInfo = {
    id,
    nombre,
    numero: numero ?? null,
    circuito: circuito ?? null,
    timezone,
  };
  memCongregations.set(id, cong);
  return cong;
}

// ---------- Profile ----------

export async function updateUserProfile(
  userId: string,
  congregationId: string,
  data: { nombre?: string; email?: string; password?: string }
): Promise<AuthUser> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const updateData: Record<string, unknown> = {};
        if (data.nombre) updateData.nombre = data.nombre;
        if (data.email) updateData.email = data.email.toLowerCase();
        if (data.password) updateData.passwordHash = await hashPassword(data.password);
        if (Object.keys(updateData).length > 0) {
          await db.update(users).set(updateData).where(eq(users.id, userId));
        }
        const rows = await db.select().from(users).where(eq(users.id, userId));
        const r = rows[0];
        if (r) {
          return { id: r.id, congregationId: r.congregationId, email: r.email, nombre: r.nombre, rol: r.rol };
        }
      }
    } catch {
      // fallback to memory
    }
  }
  // In-memory fallback
  for (const u of memUsers.values()) {
    if (u.id === userId) {
      if (data.nombre) u.nombre = data.nombre;
      if (data.email) u.email = data.email.toLowerCase();
      if (data.password) u.passwordHash = await hashPassword(data.password);
      return { id: u.id, congregationId: u.congregationId, email: u.email, nombre: u.nombre, rol: u.rol };
    }
  }
  throw new Error("Usuario no encontrado");
}

// ---------- Password Reset ----------

export async function resetPassword(email: string): Promise<{ message: string; tempPassword?: string }> {
  const e = email.toLowerCase();
  const tempPassword = randomUUID().slice(0, 8);

  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db.select().from(users).where(eq(users.email, e));
        const user = rows[0];
        if (!user) {
          // Don't reveal if user exists
          return { message: "Si el email existe, se ha restablecido la contraseña" };
        }
        const hash = await hashPassword(tempPassword);
        await db.update(users).set({ passwordHash: hash }).where(eq(users.id, user.id));
        return { message: "Contraseña restablecida", tempPassword };
      }
    } catch {
      // fallback to memory
    }
  }

  const user = memUsers.get(e);
  if (user) {
    user.passwordHash = await hashPassword(tempPassword);
    return { message: "Contraseña restablecida", tempPassword };
  }
  return { message: "Si el email existe, se ha restablecido la contraseña" };
}
