import { isValidEmail, normalizeTzPhone } from "@/features/checkout/validation";

/**
 * Customer account form rules (owner brief 2026-11-10: login and
 * registration UI now, Supabase Auth later). Plain functions so the same
 * rules run in the browser now and on the server when auth is connected.
 *
 * The password policy is configuration: when Supabase Auth is set up, its
 * dashboard policy must match PASSWORD_POLICY (Supabase accepts at most 72
 * characters, the bcrypt limit).
 */
export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 72,
  requireLetter: true,
  requireNumber: true,
} as const;

export const NAME_MAX = 80;

export interface PasswordCheck {
  id: "length" | "letter" | "number";
  label: string;
  met: boolean;
}

export function passwordChecks(password: string): PasswordCheck[] {
  const checks: PasswordCheck[] = [
    {
      id: "length",
      label: `At least ${PASSWORD_POLICY.minLength} characters`,
      met: password.length >= PASSWORD_POLICY.minLength && password.length <= PASSWORD_POLICY.maxLength,
    },
  ];
  if (PASSWORD_POLICY.requireLetter) {
    checks.push({ id: "letter", label: "A letter", met: /\p{L}/u.test(password) });
  }
  if (PASSWORD_POLICY.requireNumber) {
    checks.push({ id: "number", label: "A number", met: /\d/.test(password) });
  }
  return checks;
}

export type PasswordStrength = "empty" | "weak" | "fair" | "strong";

/** Guidance only; the policy checks above decide what is accepted. */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length === 0) return "empty";
  if (!passwordChecks(password).every((check) => check.met)) return "weak";
  const extras = [password.length >= 12, /[^\p{L}\d]/u.test(password), /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password)];
  return extras.filter(Boolean).length >= 2 ? "strong" : "fair";
}

function passwordError(password: string): string | undefined {
  if (password.length === 0) return "Enter a password.";
  if (password.length > PASSWORD_POLICY.maxLength) return `Keep the password under ${PASSWORD_POLICY.maxLength + 1} characters.`;
  if (!passwordChecks(password).every((check) => check.met)) return "Use a password that meets every requirement below.";
  return undefined;
}

function emailError(email: string): string | undefined {
  if (email.trim().length === 0) return "Enter your email address.";
  return isValidEmail(email) ? undefined : "Enter a valid email address, like name@example.com.";
}

export type Errors<T> = Partial<Record<keyof T, string>>;

export interface LoginValues {
  email: string;
  password: string;
}

export function validateLogin(values: LoginValues): Errors<LoginValues> {
  const errors: Errors<LoginValues> = {};
  const email = emailError(values.email);
  if (email) errors.email = email;
  if (values.password.length === 0) errors.password = "Enter your password.";
  return errors;
}

export interface RegisterValues {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export function validateRegister(values: RegisterValues): Errors<RegisterValues> {
  const errors: Errors<RegisterValues> = {};
  const name = values.fullName.trim();
  if (name.length === 0) errors.fullName = "Enter your full name.";
  else if (name.length < 2 || !/\p{L}/u.test(name)) errors.fullName = "Enter your full name.";
  else if (name.length > NAME_MAX) errors.fullName = `Keep your name under ${NAME_MAX + 1} characters.`;
  const email = emailError(values.email);
  if (email) errors.email = email;
  if (values.phone.trim().length === 0) errors.phone = "Enter your mobile number.";
  else if (!normalizeTzPhone(values.phone)) errors.phone = "Enter a Tanzanian mobile number, like 0712 345 678.";
  const password = passwordError(values.password);
  if (password) errors.password = password;
  if (values.confirmPassword.length === 0) errors.confirmPassword = "Enter the password again.";
  else if (values.confirmPassword !== values.password) errors.confirmPassword = "The passwords do not match.";
  if (!values.acceptTerms) errors.acceptTerms = "Accept the Terms of Service and Privacy Policy to continue.";
  return errors;
}

export interface ForgotValues {
  email: string;
}

export function validateForgot(values: ForgotValues): Errors<ForgotValues> {
  const email = emailError(values.email);
  return email ? { email } : {};
}

export interface ResetValues {
  password: string;
  confirmPassword: string;
}

export function validateReset(values: ResetValues): Errors<ResetValues> {
  const errors: Errors<ResetValues> = {};
  const password = passwordError(values.password);
  if (password) errors.password = password;
  if (values.confirmPassword.length === 0) errors.confirmPassword = "Enter the new password again.";
  else if (values.confirmPassword !== values.password) errors.confirmPassword = "The passwords do not match.";
  return errors;
}
