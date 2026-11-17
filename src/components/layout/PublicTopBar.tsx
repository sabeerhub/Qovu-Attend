import { QovuBrand } from '@/components/brand/QovuBrand';
import { Button } from '@/components/ui/button';

/**
 * Slim sticky top bar for public pages (v0.8.2) — landing, contact,
 * privacy, terms. Qovu mark on the left (goes home), Sign in /
 * Create account on the right. Solid white with a hairline border:
 * no blur, no glass, no shadow.
 */
export function PublicTopBar({
  onHome,
  onSignIn,
  onSignUp,
}: {
  onHome: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-4 py-3 md:px-6">
        <button type="button" onClick={onHome} aria-label="Qovu — back to the home page">
          <QovuBrand markSize={24} textClassName="text-[17px]" />
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onSignIn}>
            Sign in
          </Button>
          <Button onClick={onSignUp}>Create account</Button>
        </div>
      </div>
    </header>
  );
}
