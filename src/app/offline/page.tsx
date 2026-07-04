"use client";

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="w-12 h-12 rounded-full border border-pa-green/40 flex items-center justify-center mb-6">
        <span className="text-pa-green text-2xl">⚡</span>
      </div>
      <h1 className="text-2xl font-bold mb-3">You&apos;re offline</h1>
      <p className="text-muted-foreground max-w-sm mb-8">
        prime-atlas needs a connection to load live signals and scores.
        Your watchlist is available when you reconnect.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-primary text-white font-semibold px-6 py-2.5 rounded-md hover:bg-primary/85 transition-colors"
      >
        Try again
      </button>
    </main>
  );
}
