import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-orange-600 to-amber-400" />
          <div className="p-6 space-y-2 text-center">
            <p className="text-3xl font-bold text-stone-200">404</p>
            <h1 className="text-base font-bold text-stone-900">Page not found</h1>
            <p className="text-sm text-stone-500">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="block w-full rounded-lg bg-orange-600 py-2.5 text-center text-sm font-medium text-white hover:bg-orange-700 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
