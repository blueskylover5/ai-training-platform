"use client";

import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:px-6">
      <div role="alert" className="rounded-xl border border-line bg-surface px-5 py-8">
        <h1 className="text-lg font-semibold text-ink">The figures could not be loaded</h1>
        <p className="mt-2 text-sm text-ink-2">Something went wrong on our side. Please try again in a moment.</p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-4 rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-grid/50"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
