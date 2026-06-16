"use client";

import { useState, useRef, useEffect } from "react";
import { getToken } from "@/lib/auth/getSession";
import { motion } from "framer-motion";
interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Suggestion {
  doctorId: string;
  doctorName: string;
  date: string;
  timeSlot: string;
}

export default function AISchedulingPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [clinicId, setClinicId] = useState<string>("");
  const [booking, setBooking] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setClinicId(payload.clinicId || "");
    } catch {}
  }, []);

  // scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // greet user when panel opens for first time
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            'Hi! I can help you find the best appointment slot. Just describe what you need — for example: "I need a morning appointment next week" or "Any slot with Dr. Adekunle Olatunji this Friday".',
        },
      ]);
    }
  }, [open, messages.length]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setSuggestions([]);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      if (!clinicId) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "You need to set a clinic in your settings before I can find available slots for you.",
          },
        ]);
        return;
      }

      const res = await fetch("/api/scheduling", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          clinicId,
          message: userMessage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || "Something went wrong. Please try again.",
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);

      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I ran into an issue. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleBookSuggestion(suggestion: Suggestion) {
    setBooking(suggestion.timeSlot);
    setSuggestions([]);

    try {
      const token = getToken();
      if (!token) return;

      const payload = JSON.parse(atob(token.split(".")[1]));
      const patientId = payload.userId;

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId,
          doctorId: suggestion.doctorId,
          clinicId,
          date: new Date(suggestion.date).toISOString(),
          timeSlot: suggestion.timeSlot,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Sorry, I couldn't book that slot: ${data.error || "Please try again."}`,
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ Done! Your appointment with ${suggestion.doctorName} on ${new Date(suggestion.date).toDateString()} at ${suggestion.timeSlot} has been booked. You'll receive a WhatsApp confirmation shortly.`,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Booking failed. Please try again or use the Book Slot page.",
        },
      ]);
    } finally {
      setBooking(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function clearChat() {
    setMessages([]);
    setSuggestions([]);
    setInput("");
  }

  return (
    <>
      {/* TOGGLE BUTTON */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 px-2 sm:px-3 py-3 sm:py-4 rounded-l-lg shadow-lg transition-all ${
          open
            ? "bg-gray-700 text-white"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
        title="CareQueue's AI Scheduling Assistant"
      >
        <span
          className="text-xs font-semibold tracking-wide"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          {open ? "Close AI" : "AI Scheduler"}
        </span>
      </button>

      {/* SLIDING PANEL */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-95 bg-white shadow-2xl z-1000 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-blue-600 text-white">
          <div>
            <h2 className="font-bold text-sm">
              CareQueue&apos;s AI Scheduling Assistant
            </h2>
            <p className="text-xs text-blue-100 mt-0.5">Powered by Claude</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearChat}
              className="text-xs text-blue-100 hover:text-white transition"
              title="Clear conversation"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-blue-100 hover:text-white text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-100 text-gray-800 rounded-bl-none"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg rounded-bl-none px-3 py-2">
                <div className="flex gap-1 items-center h-4">
                  <span
                    className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/**
           * SUGGESTION CARDS
           * Rendered below messages when Claude
           * returns slot suggestions.
           * Each card is a one-click booking action.
           */}
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Available Slots
              </p>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="border border-blue-200 rounded-lg p-3 bg-blue-50"
                >
                  <p className="text-sm font-semibold text-gray-800">
                    {s.doctorName}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {new Date(s.date).toDateString()} · {s.timeSlot}
                  </p>
                  <button
                    onClick={() => handleBookSuggestion(s)}
                    disabled={!!booking}
                    className="mt-2 w-full text-xs bg-blue-600 text-white py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {booking === s.timeSlot ? "Booking..." : "Book This Slot"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-4 border-t border-gray-200 bg-white">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you need..."
              rows={2}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-black resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition self-end"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/**
       * OVERLAY
       * Dimmed background when panel is open.
       * Clicking it closes the panel.
       */}
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-20"
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.25)",
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
