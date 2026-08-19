import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Pagination from "../ui/Pagination";
import SearchInput from "../ui/SearchInput";
import ClinicGuard from "../ClinicGuard";

describe("shared UI components", () => {
  afterEach(() => cleanup());

  it("does not render pagination controls for a single page", () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        onPageChange={() => undefined}
      />,
    );
    expect(container.childElementCount).toBe(0);
  });

  it("renders a bounded pagination window with navigation controls", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={10}
        totalPages={20}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByText("Page 10 of 20")).toBeTruthy();
    expect(screen.getAllByText("...")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Next →" }));
    expect(onPageChange).toHaveBeenCalledWith(11);
  });

  it("debounces an asynchronous search callback", async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(
      <SearchInput
        placeholder="Search patients"
        debounceMs={10}
        onSearch={onSearch}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search patients"), {
      target: { value: "Ada" },
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(onSearch).toHaveBeenLastCalledWith("Ada");
    vi.useRealTimers();
  });

  it("shows the appropriate clinic setup link when access is blocked", () => {
    render(
      <ClinicGuard hasClinic={false} role="admin">
        <span>Protected</span>
      </ClinicGuard>,
    );
    expect(
      screen.getByRole("link", { name: /create clinic/i }).getAttribute("href"),
    ).toBe("/dashboard/clinic");
  });
});
