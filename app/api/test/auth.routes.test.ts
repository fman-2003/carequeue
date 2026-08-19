import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loginUser: vi.fn(), signupUser: vi.fn() }));
vi.mock("@/lib/services/auth.service", () => mocks);

import { POST as login } from "../auth/login/route";
import { POST as signup } from "../auth/signup/route";

const jsonRequest = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("authentication routes", () => {
  beforeEach(() => {
    mocks.loginUser.mockReset();
    mocks.signupUser.mockReset();
  });

  it("returns validation errors without sending malformed signup data to the service", async () => {
    const response = await signup(
      jsonRequest("http://care.test/api/auth/signup", {
        name: "A",
        email: "not-an-email",
        password: "short",
      }) as never,
    );
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("Name must be at least 2 characters"),
    });
    expect(response.status).toBe(422);
    expect(mocks.signupUser).not.toHaveBeenCalled();
  });

  it("returns a created account after awaiting the signup service", async () => {
    mocks.signupUser.mockResolvedValue({
      token: "token",
      user: { id: "user-1" },
    });
    const response = await signup(
      jsonRequest("http://care.test/api/auth/signup", {
        name: "Ada",
        email: "ada@test.com",
        password: "secret1",
        role: "patient",
      }) as never,
    );
    await expect(response.json()).resolves.toEqual({
      token: "token",
      user: { id: "user-1" },
    });
    expect(response.status).toBe(201);
  });

  it("does not call login for invalid credentials input", async () => {
    const response = await login(
      jsonRequest("http://care.test/api/auth/login", {
        email: "bad",
        password: "x",
      }) as never,
    );
    expect(response.status).toBe(422);
    expect(mocks.loginUser).not.toHaveBeenCalled();
  });

  it("maps asynchronous login failures to an unauthorized response", async () => {
    mocks.loginUser.mockRejectedValue(new Error("Invalid email or password"));
    const response = await login(
      jsonRequest("http://care.test/api/auth/login", {
        email: "ada@test.com",
        password: "secret1",
      }) as never,
    );
    await expect(response.json()).resolves.toEqual({
      error: "Invalid email or password",
    });
    expect(response.status).toBe(401);
  });
});
