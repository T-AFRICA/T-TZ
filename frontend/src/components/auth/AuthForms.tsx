"use client";

import { Mail, Phone, UserRound } from "lucide-react";
import {
  NAME_MAX,
  PASSWORD_POLICY,
  validateForgot,
  validateRegister,
  validateReset,
  type ForgotValues,
  type RegisterValues,
  type ResetValues,
} from "@/features/auth/rules";
import { authService } from "@/features/auth/service";
import { useAuthForm } from "@/features/auth/useAuthForm";
import { AuthMessage, IconField, PasswordField, SubmitButton } from "./AuthFields";
import { AuthLink } from "./LoginScreen";
import { PasswordStrength } from "./PasswordStrength";

/**
 * Registration and password-recovery forms on the shared account-screen
 * fields (the login form lives in LoginScreen.tsx). Each validates in the
 * browser and then calls features/auth/service.ts, which is not connected
 * yet and answers "not_connected", so the form shows "Authentication will be
 * available when account services are connected." No form redirects, claims
 * success, stores credentials or logs values.
 */

const icon = (Icon: typeof Mail) => <Icon size={18} strokeWidth={1.8} />;

export function RegisterForm() {
  const form = useAuthForm<RegisterValues>({
    initial: { fullName: "", email: "", phone: "", password: "", confirmPassword: "", acceptTerms: false },
    validate: validateRegister,
    submit: ({ fullName, email, phone, password }) =>
      authService.signUp({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), password }),
  });
  const { values, errors } = form;
  return (
    <form ref={form.formRef} noValidate onSubmit={form.onSubmit} className="login-form space-y-3.5">
      <IconField
        label="Full name"
        name="fullName"
        autoComplete="name"
        placeholder="Enter your full name"
        maxLength={NAME_MAX}
        icon={icon(UserRound)}
        value={values.fullName}
        error={errors.fullName}
        onChange={(event) => form.setValue("fullName", event.target.value)}
        onBlur={() => form.touch("fullName")}
      />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <IconField
          label="Email address"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          maxLength={254}
          icon={icon(Mail)}
          value={values.email}
          error={errors.email}
          onChange={(event) => form.setValue("email", event.target.value)}
          onBlur={() => form.touch("email")}
        />
        <IconField
          label="Mobile number"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0712 345 678"
          maxLength={20}
          icon={icon(Phone)}
          value={values.phone}
          error={errors.phone}
          onChange={(event) => form.setValue("phone", event.target.value)}
          onBlur={() => form.touch("phone")}
        />
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          placeholder="Create a password"
          maxLength={PASSWORD_POLICY.maxLength}
          describedBy="register-password-rules"
          value={values.password}
          error={errors.password}
          onChange={(event) => form.setValue("password", event.target.value)}
          onBlur={() => form.touch("password")}
        />
        <PasswordField
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Enter the password again"
          maxLength={PASSWORD_POLICY.maxLength}
          value={values.confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) => form.setValue("confirmPassword", event.target.value)}
          onBlur={() => form.touch("confirmPassword")}
        />
      </div>
      <PasswordStrength id="register-password-rules" password={values.password} />
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
            className="mt-0.5 h-[1.1rem] w-[1.1rem] shrink-0 rounded accent-[var(--color-action-red)]"
          />
          <span>
            I agree to the <AuthLink href="/policies/terms">Terms of Service</AuthLink> and{" "}
            <AuthLink href="/policies/privacy">Privacy Policy</AuthLink>.
          </span>
        </label>
        {errors.acceptTerms ? (
          <p id="register-terms-error" className="auth-message mt-1.5 text-xs font-medium text-[var(--color-action-red)]">
            {errors.acceptTerms}
          </p>
        ) : null}
      </div>
      <SubmitButton pending={form.pending}>Create account</SubmitButton>
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
    <form ref={form.formRef} noValidate onSubmit={form.onSubmit} className="login-form space-y-3.5">
      <IconField
        label="Email address"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="Enter your email address"
        maxLength={254}
        icon={icon(Mail)}
        value={form.values.email}
        error={form.errors.email}
        onChange={(event) => form.setValue("email", event.target.value)}
        onBlur={() => form.touch("email")}
      />
      <p className="text-xs text-[var(--text-secondary)]">Use the email address of your TRONIC account.</p>
      <SubmitButton pending={form.pending}>Reset password</SubmitButton>
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
    <form ref={form.formRef} noValidate onSubmit={form.onSubmit} className="login-form space-y-3.5">
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        placeholder="Create a new password"
        maxLength={PASSWORD_POLICY.maxLength}
        describedBy="reset-password-rules"
        value={values.password}
        error={errors.password}
        onChange={(event) => form.setValue("password", event.target.value)}
        onBlur={() => form.touch("password")}
      />
      <PasswordStrength id="reset-password-rules" password={values.password} />
      <PasswordField
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="Enter the new password again"
        maxLength={PASSWORD_POLICY.maxLength}
        value={values.confirmPassword}
        error={errors.confirmPassword}
        onChange={(event) => form.setValue("confirmPassword", event.target.value)}
        onBlur={() => form.touch("confirmPassword")}
      />
      <SubmitButton pending={form.pending}>Update password</SubmitButton>
      <AuthMessage message={form.message} />
    </form>
  );
}
