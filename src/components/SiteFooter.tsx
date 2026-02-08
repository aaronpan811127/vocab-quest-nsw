import { Gamepad2 } from "lucide-react";
import { Link } from "react-router-dom";

export const SiteFooter = () => {
  return (
    <footer className="py-8 px-4 sm:px-6 border-t bg-card">
      <div className="max-w-6xl mx-auto flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-primary">
              <Gamepad2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">VocabQuests</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap justify-center sm:justify-end">
            <Link to="/terms?tab=website" className="hover:text-foreground transition-colors">
              Website T&C
            </Link>
            <span className="text-border">|</span>
            <Link to="/terms?tab=subscription" className="hover:text-foreground transition-colors">
              Subscription T&C
            </Link>
            <span className="text-border">|</span>
            <Link to="/terms?tab=privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <span className="text-border">|</span>
            <Link to="/contact" className="hover:text-foreground transition-colors">
              Contact
            </Link>
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          © {new Date().getFullYear()} VocabQuests. Making vocabulary learning fun.
        </p>
      </div>
    </footer>
  );
};
