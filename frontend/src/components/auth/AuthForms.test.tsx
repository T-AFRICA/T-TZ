import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm, RegisterForm, ResetPasswordForm } from "./AuthForms";
import { LoginForm, LoginScreen } from "./LoginScreen";
import RegisterPage from "@/app/(auth)/register/page";
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";
import AuthLayout from "@/app/(auth)/layout";

const NOT_CONNECTED = "Authentication will be available when account services are connected.";
const SUCCESS = /(login|sign[- ]?in|account created|password (updated|changed)|email (has been )?sent).*success|successful|welcome back,|check your (inbox|email)/i;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("login form", () => {
  it("shows inline errors, focuses the first one, then the not-connected notice", async () => {
    const user = userEvent.setup();
    const log = vi.spyOn(console, "log");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/)).toHaveFocus();

    await user.type(screen.getByLabelText(/Email address/), "amina@example.com");
    await user.type(screen.getByLabelText(/^Password/), "secret-pass-1");
    await user.click(screen.getByRole("checkbox", { name: "Remember me" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("status")).toHaveTextContent(NOT_CONNECTED);
    expect(document.body.textContent).not.toMatch(SUCCESS);
    expect(setItem).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("shows and hides the password with a real button", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const password = screen.getByLabelText(/^Password/);
    expect(password).toHaveAttribute("type", "password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });

  it("links to forgot password", () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
  });
});

describe("account screens share one design", () => {
  it("register and forgot password use the same showroom shell", () => {
    const { container, unmount } = render(
      <AuthLayout>
        <RegisterPage />
      </AuthLayout>,
    );
    expect(container.querySelector("[data-auth-screen]")).not.toBeNull();
    expect(container.querySelector("[data-long]")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Create your Account");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Back to shopping" })).toHaveAttribute("href", "/");
    unmount();
    render(<ForgotPasswordPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Forgot Password?");
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });
});

describe("login screen", () => {
  it("stands alone with the brand, showcase, register link and a way back to the shop", () => {
    const { container } = render(
      <AuthLayout>
        <LoginScreen />
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
  it("checks phone, password rules, matching and terms before the notice", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
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

    await user.clear(screen.getByLabelText(/Mobile number/));
    await user.type(screen.getByLabelText(/Mobile number/), "0712 345 678");
    await user.clear(screen.getByLabelText(/^Password/));
    await user.type(screen.getByLabelText(/^Password/), "Tronic-2026");
    await user.clear(screen.getByLabelText(/Confirm password/));
    await user.type(screen.getByLabelText(/Confirm password/), "Tronic-2026");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("status")).toHaveTextContent(NOT_CONNECTED);
    expect(document.body.textContent).not.toMatch(SUCCESS);
  });
});

describe("password recovery forms", () => {
  it("forgot password validates the email and never claims an email was sent", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Email address/), "amina@example.com");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByRole("status")).toHaveTextContent(NOT_CONNECTED);
    expect(document.body.textContent).not.toMatch(SUCCESS);
  });

  it("reset password requires matching passwords that meet the policy", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText(/New password/), "abcdefg1");
    await user.type(screen.getByLabelText(/Confirm new password/), "abcdefg2");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByText("The passwords do not match.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Confirm new password/));
    await user.type(screen.getByLabelText(/Confirm new password/), "abcdefg1");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("status")).toHaveTextContent(NOT_CONNECTED);
  });
});
