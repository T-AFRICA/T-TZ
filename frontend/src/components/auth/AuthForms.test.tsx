import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthFormState } from "@/features/auth/state";

/**
 * The account forms post to server actions (features/auth/actions.ts). The
 * actions are replaced here so the tests see exactly what a form sends and
 * how it renders each answer; the actions themselves are covered in
 * features/auth/actions.test.ts and, without JavaScript, by the browser
 * test in e2e/forms-no-js.spec.ts.
 */
const actions = vi.hoisted(() => {
  const formAction = () => vi.fn<(state: AuthFormState, form: FormData) => Promise<AuthFormState>>(async () => ({ status: "idle" }));
  return {
    signInAction: formAction(),
    signUpAction: formAction(),
    requestPasswordResetAction: formAction(),
    updatePasswordAction: formAction(),
    signOutAction: vi.fn(async () => undefined),
  };
});
vi.mock("@/features/auth/actions", () => actions);
vi.mock("@/features/auth/server", () => ({ authEnabledForRequest: async () => false, authConfigured: () => false }));

import { ForgotPasswordForm, RegisterForm, ResetPasswordForm } from "./AuthForms";
import { LoginForm, LoginScreen } from "./LoginScreen";
import RegisterPage from "@/app/(auth)/register/page";
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";
import AuthLayout from "@/app/(auth)/layout";

const NOT_CONNECTED = "Authentication will be available when account services are connected.";
const SUCCESS = /(login|sign[- ]?in|account created|password (updated|changed)|email (has been )?sent).*success|successful|welcome back,/i;

beforeEach(() => {
  for (const action of Object.values(actions)) action.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const sent = (form: FormData) => Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));

describe("account forms while auth is not configured", () => {
  it("disable submission and say why; nothing is posted", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<LoginForm enabled={false} />);
    expect(screen.getByRole("status")).toHaveTextContent(NOT_CONNECTED);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    await user.type(screen.getByLabelText(/Email address/), "amina@example.com");
    await user.type(screen.getByLabelText(/^Password/), "secret-pass-1{Enter}");
    expect(actions.signInAction).not.toHaveBeenCalled();
    unmount();

    for (const [Form, name] of [
      [RegisterForm, "Create account"],
      [ForgotPasswordForm, "Reset password"],
      [ResetPasswordForm, "Update password"],
    ] as const) {
      const view = render(<Form enabled={false} />);
      expect(screen.getByRole("button", { name })).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent(NOT_CONNECTED);
      view.unmount();
    }
  });
});

describe("login form", () => {
  it("validates in the browser first, then posts the form to the sign-in action", async () => {
    const user = userEvent.setup();
    const log = vi.spyOn(console, "log");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    actions.signInAction.mockResolvedValueOnce({ status: "error", code: "invalid_credentials" });
    render(<LoginForm enabled />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/)).toHaveFocus();
    expect(actions.signInAction).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Email address/), "amina@example.com");
    await user.type(screen.getByLabelText(/^Password/), "secret-pass-1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(actions.signInAction).toHaveBeenCalledTimes(1));
    expect(sent(actions.signInAction.mock.calls[0]![1])).toMatchObject({ email: "amina@example.com", password: "secret-pass-1" });
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password don't match an account.");
    expect(document.body.textContent).not.toMatch(SUCCESS);
    expect(setItem).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("shows errors the server found (a post without JavaScript)", async () => {
    const user = userEvent.setup();
    actions.signInAction.mockResolvedValueOnce({
      status: "invalid",
      fieldErrors: { email: "Enter a valid email address, like name@example.com." },
    });
    render(<LoginForm enabled />);
    await user.type(screen.getByLabelText(/Email address/), "amina@example.com");
    await user.type(screen.getByLabelText(/^Password/), "secret-pass-1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address, like name@example.com.")).toBeInTheDocument();
  });

  it("shows and hides the password with a real button", async () => {
    const user = userEvent.setup();
    render(<LoginForm enabled />);
    const password = screen.getByLabelText(/^Password/);
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });

  it("links to forgot password", () => {
    render(<LoginForm enabled />);
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
  });
});

describe("account screens share one design", () => {
  it("register and forgot password use the same showroom shell", async () => {
    const { container, unmount } = render(<AuthLayout>{await RegisterPage()}</AuthLayout>);
    expect(container.querySelector("[data-auth-screen]")).not.toBeNull();
    expect(container.querySelector("[data-long]")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Create your Account");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Back to shopping" })).toHaveAttribute("href", "/");
    unmount();
    render(await ForgotPasswordPage());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Forgot Password?");
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });
});

describe("login screen", () => {
  it("stands alone with the brand, showcase, register link and a way back to the shop", () => {
    const { container } = render(
      <AuthLayout>
        <LoginScreen authEnabled={false} />
      </AuthLayout>,
    );
    expect(container.querySelector("[data-auth-screen]")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome Back");
    expect(screen.getByRole("link", { name: "TRONIC home" })).toHaveAttribute("href", "/");
    // One showcase for phones and one for laptops; CSS shows only one at a time.
    expect(screen.getAllByRole("img", { name: "TRONIC LED bulb" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Back to shopping" })).toHaveAttribute("href", "/");
    // No decorative step dots and no unverified delivery promises.
    expect(container.textContent).not.toMatch(/across tanzania|24\/7|same[- ]day|guaranteed/i);
  });
});

describe("register form", () => {
  it("checks phone, password rules, matching and terms before posting", async () => {
    const user = userEvent.setup();
    actions.signUpAction.mockResolvedValueOnce({
      status: "sent",
      text: "Check your email: we sent a link to confirm your account. Then sign in.",
    });
    render(<RegisterForm enabled />);
    await user.type(screen.getByLabelText(/Full name/), "Amina Juma");
    await user.type(screen.getByLabelText(/Email address/), "amina@example.com");
    await user.type(screen.getByLabelText(/Mobile number/), "0812 000 000");
    await user.type(screen.getByLabelText(/^Password/), "short");
    await user.type(screen.getByLabelText(/Confirm password/), "different");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Enter a Tanzanian mobile number, like 0712 345 678.")).toBeInTheDocument();
    expect(screen.getByText("Use a password that meets every requirement below.")).toBeInTheDocument();
    expect(screen.getByText("The passwords do not match.")).toBeInTheDocument();
    expect(screen.getByText("Accept the Terms of Service and Privacy Policy to continue.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Mobile number/)).toHaveFocus();
    expect(screen.getByText("Strength: Weak")).toBeInTheDocument();
    expect(actions.signUpAction).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/Mobile number/));
    await user.type(screen.getByLabelText(/Mobile number/), "0712 345 678");
    await user.clear(screen.getByLabelText(/^Password/));
    await user.type(screen.getByLabelText(/^Password/), "Tronic-2026");
    await user.clear(screen.getByLabelText(/Confirm password/));
    await user.type(screen.getByLabelText(/Confirm password/), "Tronic-2026");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(actions.signUpAction).toHaveBeenCalledTimes(1));
    expect(sent(actions.signUpAction.mock.calls[0]![1])).toMatchObject({
      fullName: "Amina Juma",
      email: "amina@example.com",
      phone: "0712 345 678",
      acceptTerms: "on",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Check your email");
  });
});

describe("password recovery forms", () => {
  it("forgot password validates the email, posts it and gives the same answer for any address", async () => {
    const user = userEvent.setup();
    actions.requestPasswordResetAction.mockResolvedValueOnce({
      status: "sent",
      text: "If an account uses that email, a link to choose a new password is on its way.",
    });
    render(<ForgotPasswordForm enabled />);
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(actions.requestPasswordResetAction).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Email address/), "amina@example.com");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If an account uses that email");
  });

  it("reset password requires matching passwords that meet the policy", async () => {
    const user = userEvent.setup();
    actions.updatePasswordAction.mockResolvedValueOnce({ status: "error", code: "link_expired" });
    render(<ResetPasswordForm enabled />);
    await user.type(screen.getByLabelText(/New password/), "abcdefg1");
    await user.type(screen.getByLabelText(/Confirm new password/), "abcdefg2");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByText("The passwords do not match.")).toBeInTheDocument();
    expect(actions.updatePasswordAction).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText(/Confirm new password/));
    await user.type(screen.getByLabelText(/Confirm new password/), "abcdefg1");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This reset link has expired");
  });
});
