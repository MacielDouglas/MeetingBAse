import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

// Auth helpers: JWT + bcrypt. In-memory user store (Fase 4A).
// TODO Fase 5: migrar para Neon (users table já existe no schema).

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

const users = new Map<string, StoredUser>(); // email -> user

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

export async function registerUser(
  email: string,
  password: string,
  nombre: string,
  congregationId: string,
  rol = "publicador"
): Promise<AuthUser> {
  const existing = users.get(email.toLowerCase());
  if (existing) throw new Error("Ya existe un usuario con ese email");

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  const user: StoredUser = {
    id,
    congregationId,
    email: email.toLowerCase(),
    nombre,
    rol,
    passwordHash,
  };
  users.set(email.toLowerCase(), user);
  return { id, congregationId, email: user.email, nombre, rol };
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ user: AuthUser; token: string }> {
  const stored = users.get(email.toLowerCase());
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
  if (users.size > 0) return;
  const email = "admin@meeting-base.local";
  if (!users.has(email)) {
    await registerUser(
      email,
      "admin123",
      "Administrador",
      "00000000-0000-0000-0000-000000000000",
      "admin"
    );
  }
}
