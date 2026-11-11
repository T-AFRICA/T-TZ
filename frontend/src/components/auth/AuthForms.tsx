"use client";

import Link from "next/link";
import { Input } from "@tronic/ui";
import {
  NAME_MAX,
  PASSWORD_POLICY,
  validateForgot,
  validateLogin,
  validateRegister,
  validateReset,
  type ForgotValues,
  type LoginValues,
  type RegisterValues,
  type ResetValues,
} from "@/features/auth/rules";
import { authService } from "@/features/auth/service";
import { useAuthForm } from "@/features/auth/useAuthForm";
import { AuthMessage, AuthSubmit } from "./AuthLayout";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrength } from "./PasswordStrength";

const LINK = "font-semibold text-[var(--color-action-red)] underline-offset-4 hover:underline";

/**
 * The four customer account forms (owner brief 2026-11-10, frontend only).
 * Each validates in the browser and then calls features/auth/service.ts,
 * which is not connected yet and answers "not_connected", so the form shows
 * "Authentication will be available when account services are connected."
 * No form redirects, claims success, stores credentials or logs values.
 */

export function LoginForm() {
  const form = useAuthForm<LoginValues & { remember: boolean }>({
    initial: { email: "", password: "", remember: false },
    validate: validateLogin,
    submit: ({ email, password, remember }) => authService.signIn({ email: email.trim(), password, remember }),
  });
  const { values, errors } = form;
  return (
    <form ref={form.formRef} noValidate onSubmit={form.onSubmit} className="space-y-4">
      <Input
        id="login-email"
        name="email"
        label="Email address"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        maxLength={254}
        value={values.email}
        error={errors.email}
        onChange={(event) => form.setValue("email", event.target.value)}
        onBlur={() => form.touch("email")}
      />
      <PasswordInput
        id="login-password"
        name="password"
        label="Password"
        autoComplete="current-password"
        required
        maxLength={PASSWORD_POLICY.maxLength}
        value={values.password}
        error={errors.password}
        onChange={(event) => form.setValue("password", event.target.value)}
        onBlur={() => form.touch("password")}
      />
      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-[var(--text-secondary)]">
          <input
            type="checkbox"
            name="remember"
            checked={values.remember}
            onChange={(event) => form.setValue("remember", event.target.checked)}
            className="h-4 w-4 accent-[var(--color-action-red)]"
          />
          Remember me
        </label>
        <Link href="/forgot-password" className={LINK}>
          Forgot password?
        </Link>
      </div>
      <AuthSubmit pending={form.pending}>Sign in</AuthSubmit>
      <AuthMessage message={form.message} />
    </form>
  );
}

export function RegisterForm() {
  const form = useAuthForm<RegisterValues>({
    initial: { fullName: "", email: "", phone: "", password: "", confirmPassword: "", acceptTerms: false },
    validate: validateRegister,
    submit: ({ fullName, email, phone, password }) =>
      authService.signUp({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), password }),
  });
  const { values, errors } = form;
  return (
    <form ref={form.formRef} noValidate onSubmit={form.onSubmit} className="space-y-4">
      <Input
        id="register-name"
        name="fullName"
        label="Full name"
        autoComplete="name"
        required
        maxLength={NAME_MAX}
        value={values.fullName}
        error={errors.fullName}
        onChange={(event) => form.setValue("fullName", event.target.value)}
        onBlur={() => form.touch("fullName")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="register-email"
          name="email"
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          value={values.email}
          error={errors.email}
          onChange={(event) => form.setValue("email", event.target.value)}
          onBlur={() => form.touch("email")}
        />
        <Input
          id="register-phone"
          name="phone"
          label="Mobile number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0712 345 678"
          required
          maxLength={20}
          value={values.phone}
          error={errors.phone}
          onChange={(event) => form.setValue("phone", event.target.value)}
          onBlur={() => form.touch("phone")}
        />
      </div>
      <PasswordInput
        id="register-password"
        name="password"
        label="Password"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_POLICY.maxLength}
        describedBy="register-password-rules"
        value={values.password}
        error={errors.password}
        onChange={(event) => form.setValue("password", event.target.value)}
        onBlur={() => form.touch("password")}
      />
      <PasswordStrength id="register-password-rules" password={values.password} />
      <PasswordInput
        id="register-confirm"
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_POLICY.maxLength}
        value={values.confirmPassword}
        error={errors.confirmPassword}
        onChange={(event) => form.setValue("confirmPassword", event.target.value)}
        onBlur={() => form.touch("confirmPassword")}
      />
      <div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            name="acceptTerms"
            checked={values.acceptTerms}
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={errors.acceptTerms ? "register-terms-error" : undefined}
            onChange={(event) => {
              form.setValue("acceptTerms", event.target.checked);
              form.touch("acceptTerms");
            }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-action-red)]"
          />
          <span>
            I agree to the{" "}
            <Link href="/policies/terms" className={LINK}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/policies/privacy" className={LINK}>
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms ? (
          <p id="register-terms-error" className="mt-1.5 text-xs font-medium text-[var(--color-action-red)]">
            {errors.acceptTerms}
          </p>
        ) : null}
      </div>
      <AuthSubmit pending={form.pending}>Create account</AuthSubmit>
      <AuthMessage message={form.message} />
    </form>
  );
}

export function ForgotPasswordForm() {
  const form = useAuthForm<ForgotValues>({
    initial: { email: "" },
    validate: validateForgot,
    submit: ({ email }) => authService.requestPasswordReset({ email: email.trim() }),
  });
  return (
    <form ref={form.formRef} noValidate onSubmit={form.onSubmit} className="space-y-4">
      <Input
        id="forgot-email"
        name="email"
        label="Email address"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        maxLength={254}
        hint="Use the email address of your TRONIC account."
        value={form.values.email}
        error={form.errors.email}
        onChange={(event) => form.setValue("email", event.target.value)}
        onBlur={() => form.touch("email")}
      />
      <AuthSubmit pending={form.pending}>Reset password</AuthSubmit>
      <AuthMessage message={form.message} />
    </form>
  );
}

export function ResetPasswordForm() {
  const form = useAuthForm<ResetValues>({
    initial: { password: "", confirmPassword: "" },
    validate: validateReset,
    submit: ({ password }) => authService.updatePassword({ password }),
  });
  const { values, errors } = form;
  return (
    <form ref={form.formRef} noValidate onSubmit={form.onSubmit} className="space-y-4">
      <PasswordInput
        id="reset-password"
        name="password"
        label="New password"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_POLICY.maxLength}
        describedBy="reset-password-rules"
        value={values.password}
        error={errors.password}
        onChange={(event) => form.setValue("password", event.target.value)}
        onBlur={() => form.touch("password")}
      />
      <PasswordStrength id="reset-password-rules" password={values.password} />
      <PasswordInput
        id="reset-confirm"
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_POLICY.maxLength}
        value={values.confirmPassword}
        error={errors.confirmPassword}
        onChange={(event) => form.setValue("confirmPassword", event.target.value)}
        onBlur={() => form.touch("confirmPassword")}
      />
      <AuthSubmit pending={form.pending}>Update password</AuthSubmit>
      <AuthMessage message={form.message} />
    </form>
  );
}
