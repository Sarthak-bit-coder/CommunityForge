import Link from "next/link";
import { Notice } from "@/components/ui/Notice";

export function SignInPrompt({ action }: { readonly action: string }) {
  return (
    <Notice label="Sign in needed">
      <p>
        <Link href="/account" className="af-link font-semibold">
          Sign in or create an account
        </Link>{" "}
        to {action}.
      </p>
    </Notice>
  );
}
