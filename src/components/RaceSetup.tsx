"use client";

import { useState } from "react";

export default function RaceSetup() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  async function submit(path: string, body: Record<string, string>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) window.location.reload();
    else setMessage("That didn’t work. Check the details and try again.");
  }
  return (
    <>
      <div className="mt-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
          Start a pack
        </h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit("/api/races", { name });
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Pack name"
            className="min-w-0 flex-1 rounded-xl border border-poodle-fur px-3 py-2 text-sm"
          />
          <button className="rounded-full bg-headband px-4 py-2 text-sm font-bold text-white">
            Create
          </button>
        </form>
      </div>
      <div className="mt-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground/60">
          Join with a code
        </h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit("/api/races/join", { code });
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Invite code"
            className="min-w-0 flex-1 rounded-xl border border-poodle-fur px-3 py-2 text-sm"
          />
          <button className="rounded-full px-4 py-2 text-sm font-bold ring-1 ring-poodle-fur">
            Join
          </button>
        </form>
      </div>
      {message && <p className="mt-2 text-xs text-red-600">{message}</p>}
    </>
  );
}
