"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="lcard p-8"><h1 className="text-2xl font-semibold">This view couldn’t be loaded.</h1><p className="my-4 text-subtle">Please try again. Your portfolio is stored on this device and stays when you reload.</p><button onClick={reset} className="btn-primary">Try again</button></div>;
}
