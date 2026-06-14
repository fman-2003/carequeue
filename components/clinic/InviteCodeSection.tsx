/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { getToken } from "../../lib/auth/getSession";

export default function InviteCodesSection() {
  const [codes, setCodes] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [role, setRole] = useState("doctor");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetch("/api/clinics/invite", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => setCodes(data.codes || []));
  }, []);

  async function generateCode() {
    setGenerating(true);
    try {
      const res = await fetch("/api/clinics/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (res.ok) {
        setCodes((prev) => [
          ...prev,
          { code: data.code, role: data.role, isUsed: false },
        ]);
      }
    } finally {
      setGenerating(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(""), 2000);
  }

  const activeCodes = codes.filter((c) => !c.isUsed);

  return (
    <div className="card p-6 mt-4">
      <h3 className="section-title mb-1">Invite Codes</h3>
      <p className="text-xs text-neutral-400 mb-4">
        Generate codes to invite doctors and receptionists to your clinic.
      </p>

      <div className="flex gap-3 mb-5">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="input flex-1"
        >
          <option value="doctor">Doctor</option>
          <option value="receptionist">Receptionist</option>
        </select>
        <button
          onClick={generateCode}
          disabled={generating}
          className="btn-primary text-sm px-5"
        >
          {generating ? "Generating..." : "+ Generate Code"}
        </button>
      </div>

      {activeCodes.length === 0 ? (
        <p className="text-neutral-400 text-sm">No active invite codes.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {activeCodes.map((c: any) => (
            <div
              key={c.code}
              className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3"
            >
              <div>
                <p className="font-mono font-bold text-sm text-neutral-800">
                  {c.code}
                </p>
                <p className="text-xs text-neutral-400 capitalize mt-0.5">
                  {c.role}
                </p>
              </div>
              <button
                onClick={() => copyCode(c.code)}
                className="text-xs text-primary hover:text-primary-dark font-medium"
              >
                {copied === c.code ? "Copied ✓" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
