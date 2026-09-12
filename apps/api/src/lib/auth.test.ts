import { describe, it, expect } from "vitest";
import {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  type AuthUser,
} from "./auth.js";

describe("hashPassword", () => {
  it("genera hash diferente de la contraseña original", async () => {
    const hash = await hashPassword("test1234");
    expect(hash).not.toBe("test1234");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("genera hashes distintos para la misma contraseña (salt)", async () => {
    const h1 = await hashPassword("test1234");
    const h2 = await hashPassword("test1234");
    expect(h1).not.toBe(h2);
  });
});

describe("comparePassword", () => {
  it("retorna true para contraseña correcta", async () => {
    const hash = await hashPassword("mypass");
    const result = await comparePassword("mypass", hash);
    expect(result).toBe(true);
  });

  it("retorna false para contraseña incorrecta", async () => {
    const hash = await hashPassword("mypass");
    const result = await comparePassword("wrong", hash);
    expect(result).toBe(false);
  });
});

describe("signToken / verifyToken", () => {
  const user: AuthUser = {
    id: "user-123",
    congregationId: "cong-456",
    email: "test@example.com",
    nombre: "Test User",
    rol: "publicador",
  };

  it("genera un token válido", () => {
    const token = signToken(user);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT: header.payload.signature
  });

  it("verifica un token válido y retorna datos del usuario", () => {
    const token = signToken(user);
    const verified = verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.id).toBe("user-123");
    expect(verified!.congregationId).toBe("cong-456");
    expect(verified!.email).toBe("test@example.com");
    expect(verified!.rol).toBe("publicador");
  });

  it("retorna null para token inválido", () => {
    const result = verifyToken("token-falso");
    expect(result).toBeNull();
  });

  it("retorna null para token expirado", () => {
    // Token con expiración en el pasado (firmado con la misma secret)
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      { sub: "user-1", congregationId: "c1", email: "a@b.com", rol: "admin" },
      process.env.JWT_SECRET ?? "meeting-base-dev-secret-change-in-prod",
      { expiresIn: "-1s" }
    );
    const result = verifyToken(token);
    expect(result).toBeNull();
  });

  it("retorna null para token firmado con otra secret", () => {
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      { sub: "user-1", congregationId: "c1", email: "a@b.com", rol: "admin" },
      "wrong-secret",
      { expiresIn: "7d" }
    );
    const result = verifyToken(token);
    expect(result).toBeNull();
  });
});
