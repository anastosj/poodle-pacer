"use client";

export default function JoinConfirm({ code }: { code: string }) {
  return (
    <button
      onClick={async () => {
        const response = await fetch("/api/races/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        window.location.href = response.ok ? "/group" : `/join/${code}`;
      }}
      className="mt-5 rounded-full bg-headband px-5 py-2 text-sm font-bold text-white"
    >
      Join the pack
    </button>
  );
}
