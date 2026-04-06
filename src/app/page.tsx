import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Pulse</h1>
      <p className="text-muted-foreground mb-8">Your social universe</p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="px-6 py-2 border border-input bg-background rounded-md hover:bg-accent"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
