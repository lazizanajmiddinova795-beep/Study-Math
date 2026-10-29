import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold text-ink">Page not found</h1>
      <p className="mb-5 mt-2 text-ink-soft">The page you are looking for does not exist.</p>
      <LinkButton href="/">Back to home</LinkButton>
    </div>
  );
}
