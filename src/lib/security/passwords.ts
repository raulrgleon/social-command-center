import { hash, verify } from "@node-rs/argon2";

const options = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string) {
  return hash(password, options);
}

export function verifyPassword(password: string, passwordHash: string) {
  return verify(passwordHash, password, options);
}

export function passwordIssue(password: string) {
  if (password.length < 10) return "La contraseña necesita al menos 10 caracteres.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Usa letras y números.";
  return null;
}
